"""Project summary persistence — deep code analysis for functional descriptions."""

import json
import os
import re
from datetime import datetime
from pathlib import Path

SUMMARY_FILE = "project_summary.json"


def _summary_path(project_path: str) -> str:
    memory_dir = Path(__file__).parent
    name = Path(project_path).name or "project"
    return str(memory_dir / f"{name}_{SUMMARY_FILE}")


# ── Swift code parsing ────────────────────────────────────────────────────────


def _extract_top_level_types(content: str) -> list[dict]:
    """Extract struct/class/enum/protocol definitions from Swift source."""
    types = []

    # Pattern: struct|class|enum|protocol|data class|interface|object Name: Conformances { ... }
    # Supports both Swift and Kotlin syntax
    # For Kotlin: data class Name(val x: Int) : SuperClass { ... }
    # The (?:\s*\([^)]*\))? part skips Kotlin constructor params
    pattern = re.compile(
        r'^(\s*)((?:@[\w.]+(?:\([^)]*\))?\s+)*)?'
        r'((?:data\s+)?(?:sealed\s+)?(?:enum\s+)?(?:struct|class|protocol|interface|object))\s+(\w+)'
        r'(?:\s*\([^)]*\))?'  # skip Kotlin constructor params
        r'(?:\s*:\s*([^{]+))?\s*\{',
        re.MULTILINE
    )

    for match in pattern.finditer(content):
        indent = match.group(1)
        attributes = match.group(2) or ""
        kind = match.group(3)
        name = match.group(4)
        conformances = match.group(5)

        # Find matching closing brace
        start = match.end() - 1  # position of opening {
        brace_count = 0
        end = start
        in_string = False
        string_char = None

        for i in range(start, len(content)):
            ch = content[i]
            if not in_string:
                if ch in '"\'':
                    in_string = True
                    string_char = ch
                elif ch == '{':
                    brace_count += 1
                elif ch == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        end = i + 1
                        break
            else:
                if ch == string_char and (i == 0 or content[i - 1] != '\\'):
                    in_string = False
                    string_char = None

        body = content[start:end]
        inner_body = content[start + 1:end - 1]  # without outer braces

        types.append({
            "name": name,
            "kind": kind,
            "attributes": attributes.strip().split() if attributes.strip() else [],
            "conformances": [c.strip() for c in conformances.split(",")] if conformances else [],
            "body": body,
            "inner_body": inner_body,
            "line_number": content[:match.start()].count("\n") + 1,
        })

    return types


def _extract_properties(inner_body: str) -> list[dict]:
    """Extract property declarations from type body."""
    props = []
    # Match property declarations: @Attribute var name: Type = ...
    prop_pattern = re.compile(
        r'(@\w+(?:\([^)]*\))?\s+)?'
        r'(var|let)\s+(\w+)\s*:\s*([^\n=]+)',
        re.MULTILINE
    )
    for match in prop_pattern.finditer(inner_body):
        attr = (match.group(1) or "").strip()
        kind = match.group(2)
        name = match.group(3)
        type_ = match.group(4).strip()
        props.append({
            "name": name,
            "kind": kind,
            "type": type_,
            "attributes": [attr] if attr else [],
        })
    return props


def _extract_methods(inner_body: str) -> list[dict]:
    """Extract method signatures from type body."""
    methods = []
    # Match func declarations (simplified)
    func_pattern = re.compile(
        r'(@\w+(?:\([^)]*\))?\s+)?'
        r'(func)\s+(\w+)\s*\(([^)]*)\)',
        re.MULTILINE
    )
    for match in func_pattern.finditer(inner_body):
        attr = (match.group(1) or "").strip()
        name = match.group(3)
        params = match.group(4).strip()
        methods.append({
            "name": name,
            "parameters": params,
            "attributes": [attr] if attr else [],
        })
    return methods


def _describe_type(type_info: dict) -> str:
    """Generate a natural language description of a Swift type."""
    name = type_info["name"]
    kind = type_info["kind"]
    conformances = type_info.get("conformances", [])
    props = type_info.get("properties", [])
    methods = type_info.get("methods", [])
    inner = type_info.get("inner_body", "")

    parts = []

    # Normalize Kotlin kinds
    base_kind = kind.replace("data ", "").replace("sealed ", "").replace("enum ", "")

    # Base description from kind + conformances
    if base_kind in ("struct", "class") and "View" in conformances:
        parts.append(f"UI 组件/View，定义界面布局和交互")
    elif base_kind == "class" and "ObservableObject" in conformances:
        parts.append(f"ObservableObject 视图模型，管理数据状态和业务逻辑")
    elif base_kind == "class" and ("ViewModel" in name or "ViewModel" in str(conformances)):
        parts.append(f"ViewModel 类，管理数据状态和业务逻辑")
    elif base_kind == "object":
        parts.append(f"单例对象 {name}")
    elif base_kind == "interface":
        parts.append(f"接口定义 {name}")
    elif kind.startswith("data "):
        parts.append(f"数据类 {name}，用于数据承载和传输")
    elif base_kind == "struct" and conformances:
        parts.append(f"{kind}，遵循 {', '.join(conformances)}")
    elif base_kind == "class":
        parts.append(f"{kind} 类")
    elif base_kind == "enum":
        parts.append(f"枚举类型")
    elif base_kind == "protocol":
        parts.append(f"协议定义")
    else:
        parts.append(f"{kind} {name}")

    # Describe from properties
    state_props = [p for p in props if any("State" in a or "StateObject" in a or "ObservedObject" in a for a in p.get("attributes", []))]
    published_props = [p for p in props if any("Published" in a for a in p.get("attributes", []))]
    app_storage = [p for p in props if any("AppStorage" in a for a in p.get("attributes", []))]
    binding_props = [p for p in props if any("Binding" in a for a in p.get("attributes", []))]

    if state_props:
        parts.append(f"包含 {len(state_props)} 个状态属性（@State/@StateObject）")
    if published_props:
        prop_names = ", ".join([p["name"] for p in published_props[:3]])
        parts.append(f"发布属性：{prop_names}")
    if app_storage:
        parts.append(f"使用 @AppStorage 持久化存储")
    if binding_props:
        parts.append(f"接收外部绑定数据")

    # Describe from methods
    lifecycle = [m for m in methods if m["name"] in ("body", "onAppear", "onDisappear", "init")]
    action_methods = [m for m in methods if any(kw in m["name"].lower() for kw in ("toggle", "clear", "load", "refresh", "save", "delete", "add", "remove", "update", "handle", "tap"))]
    compute_methods = [m for m in methods if m["name"] not in ("body", "onAppear", "onDisappear", "init") and m not in action_methods]

    if lifecycle:
        lc_names = [m["name"] for m in lifecycle]
        parts.append(f"生命周期/视图方法：{', '.join(lc_names)}")
    if action_methods:
        act_names = [m["name"] for m in action_methods[:4]]
        parts.append(f"操作方法：{', '.join(act_names)}")
    if compute_methods:
        comp_names = [m["name"] for m in compute_methods[:3]]
        parts.append(f"辅助方法：{', '.join(comp_names)}")

    # Navigation detection
    if "NavigationLink" in inner or "NavigationStack" in inner or "NavigationView" in inner:
        parts.append("包含导航跳转")
    if "List" in inner and "ForEach" in inner:
        parts.append("使用 List + ForEach 展示列表数据")
    elif "List" in inner:
        parts.append("使用 List 展示数据")
    if "VStack" in inner or "HStack" in inner or "ZStack" in inner:
        parts.append("使用 Stack 布局")

    # Alert / Sheet
    if ".alert(" in inner:
        parts.append("包含弹窗交互")
    if ".sheet(" in inner:
        parts.append("包含底部弹窗")

    return "；".join(parts)


def _describe_file(path: str, types: list[dict], imports: list[str], all_type_names: set[str]) -> str:
    """Generate a file-level description."""
    basename = os.path.basename(path)
    descriptions = []

    for t in types:
        desc = _describe_type(t)
        descriptions.append(f"{t['name']}：{desc}")

    if not descriptions:
        return f"辅助源码文件"

    return "；".join(descriptions)


def _analyze_dependencies(file_contents: dict[str, str]) -> dict[str, list[str]]:
    """Analyze which types from other files each file references."""
    # Build map of type -> defining file
    type_to_file = {}
    file_types = {}

    for path, content in file_contents.items():
        types = _extract_top_level_types(content)
        file_types[path] = [t["name"] for t in types]
        for t in types:
            type_to_file[t["name"]] = path

    # For each file, find referenced types from other files
    dependencies = {}
    for path, content in file_contents.items():
        deps = set()
        # Find type references (simplified: match capitalized words that are known types)
        for type_name, def_path in type_to_file.items():
            if def_path == path:
                continue
            # Match the type name as a whole word (not part of another word)
            pattern = r'\b' + re.escape(type_name) + r'\b'
            if re.search(pattern, content):
                deps.add(type_name)
        dependencies[path] = sorted(deps)

    return dependencies


# ── Project-level analysis ────────────────────────────────────────────────────


def _detect_language(files: list[str]) -> str:
    has_swift = any(f.endswith(".swift") for f in files)
    has_objc = any(f.endswith((".m", ".h", ".mm")) for f in files)
    has_kotlin = any(f.endswith(".kt") for f in files)
    has_java = any(f.endswith(".java") for f in files)
    langs = []
    if has_swift:
        langs.append("Swift")
    if has_objc:
        langs.append("Objective-C")
    if has_kotlin:
        langs.append("Kotlin")
    if has_java:
        langs.append("Java")
    if len(langs) > 1:
        return "Mixed (" + " + ".join(langs) + ")"
    if langs:
        return langs[0]
    return "Unknown"


def _detect_architecture(file_types: dict[str, list[dict]], file_contents: dict[str, str]) -> str:
    all_type_names = set()
    has_view = False
    has_vm = False
    has_vc = False
    has_swiftui = False
    has_uikit = False
    has_compose = False
    has_xml = False

    for path, types in file_types.items():
        for t in types:
            all_type_names.add(t["name"])
            confs = t.get("conformances", [])
            if "View" in confs:
                has_view = True
            if "ComponentActivity" in confs:
                has_compose = True
            if t["name"].endswith("ViewModel"):
                has_vm = True
            if t["name"].endswith("ViewController"):
                has_vc = True
            if "SwiftUI" in confs or (t["kind"] == "struct" and "View" in confs):
                has_swiftui = True

    # Check file contents for Compose patterns (composable functions are not classes)
    all_text = "\n".join(file_contents.values())
    if "@Composable" in all_text and ("NavHost" in all_text or "Scaffold" in all_text or "setContent" in all_text):
        has_compose = True
    if "UIKit" in all_text:
        has_uikit = True

    if has_compose and has_vm:
        return "MVVM + Jetpack Compose"
    if has_compose:
        return "Jetpack Compose"
    if has_swiftui and has_vm:
        return "MVVM + SwiftUI"
    if has_swiftui:
        return "SwiftUI"
    if has_vc and has_vm:
        return "MVVM + UIKit"
    if has_vc:
        return "MVC + UIKit"
    if has_view:
        return "View-based"
    return "Unknown"


def _detect_patterns(file_types: dict[str, list[dict]]) -> list[str]:
    patterns = set()
    all_text = ""
    for types in file_types.values():
        for t in types:
            body = t.get("inner_body", "")
            attrs = " ".join(t.get("attributes", []))
            all_text += body + "\n"
            if "@StateObject" in attrs or "@StateObject" in body:
                patterns.add("@StateObject")
            if "@ObservedObject" in attrs or "@ObservedObject" in body:
                patterns.add("@ObservedObject")
            if "@State" in attrs or "@State" in body:
                patterns.add("@State")
            if "ObservableObject" in str(t.get("conformances", [])) or "ObservableObject" in body:
                patterns.add("ObservableObject")
            if "NavigationStack" in body:
                patterns.add("NavigationStack")
            if "NavigationView" in body:
                patterns.add("NavigationView")
            if "@AppStorage" in attrs or "@AppStorage" in body:
                patterns.add("@AppStorage")
            if "Combine" in body:
                patterns.add("Combine")
            if "@Binding" in attrs or "@Binding" in body:
                patterns.add("@Binding")
            if "@Environment" in body:
                patterns.add("@Environment")
            if "Sheet" in body or ".sheet(" in body:
                patterns.add("Sheet")
            if "Task" in body or ".task(" in body:
                patterns.add("async/await Task")
            # Kotlin / Compose patterns
            if "@Composable" in attrs or "@Composable" in body:
                patterns.add("@Composable")
            if "mutableStateOf" in body:
                patterns.add("mutableStateOf")
            if "MutableStateFlow" in body:
                patterns.add("MutableStateFlow")
            if "collectAsState" in body:
                patterns.add("collectAsState")
            if "NavHost" in body or "NavController" in body:
                patterns.add("Navigation Compose")
            if "Scaffold" in body:
                patterns.add("Scaffold")
            if "LazyColumn" in body:
                patterns.add("LazyColumn")
            if "ViewModel" in body or t["name"].endswith("ViewModel"):
                patterns.add("ViewModel")
            if "data class" in body:
                patterns.add("data class")
            if "@Preview" in attrs:
                patterns.add("@Preview")
            if "remember" in body:
                patterns.add("remember")
    return sorted(patterns)


def _detect_code_style(file_contents: dict[str, str]) -> dict:
    all_text = "\n".join(file_contents.values())

    prefix_match = re.search(r'(?:class|struct)\s+([A-Z]{2,})[A-Z]\w+', all_text)
    prefix = prefix_match.group(1) if prefix_match else None

    has_doc = "///" in all_text
    has_mark = "// MARK:" in all_text
    comments = "Documentation + MARK" if has_doc and has_mark else ("Documentation" if has_doc else ("MARK sections" if has_mark else "Minimal"))

    imports = list(set(re.findall(r'^import\s+(\w+)', all_text, re.MULTILINE)))

    return {
        "prefix": prefix,
        "naming": "CamelCase with prefix" if prefix else "CamelCase",
        "comments": comments,
        "imports": imports
    }


# ── Public API ────────────────────────────────────────────────────────────────


def generate_summary(project_path: str) -> dict:
    """Generate a full project summary with deep code analysis."""
    abs_path = os.path.abspath(project_path)

    # Collect source files
    source_files = []
    for root, dirs, files in os.walk(abs_path):
        dirs[:] = [d for d in dirs if not d.startswith(".") and d not in ("build", "DerivedData", "__pycache__", "Pods")]
        for fname in files:
            if fname.startswith("."):
                continue
            if fname.endswith((".swift", ".m", ".h", ".mm", ".xib", ".storyboard", ".kt", ".java", ".xml")):
                source_files.append(os.path.join(root, fname))

    # Read and parse source files
    file_contents = {}
    file_types = {}  # path -> list of type dicts
    for f in source_files:
        if f.endswith((".swift", ".kt", ".java")):
            try:
                with open(f, "r", encoding="utf-8") as fh:
                    content = fh.read()
                file_contents[f] = content
                types = _extract_top_level_types(content)
                for t in types:
                    t["properties"] = _extract_properties(t["inner_body"])
                    t["methods"] = _extract_methods(t["inner_body"])
                    t["description"] = _describe_type(t)
                file_types[f] = types
            except Exception:
                file_types[f] = []

    # Build all type names set
    all_type_names = set()
    for types in file_types.values():
        for t in types:
            all_type_names.add(t["name"])

    # Analyze dependencies
    dependencies = _analyze_dependencies(file_contents)

    # Build file summaries
    file_summaries = []
    for f in source_files:
        rel_path = os.path.relpath(f, abs_path)
        types = file_types.get(f, [])
        imports = re.findall(r'^import\s+(\w+)', file_contents.get(f, ""), re.MULTILINE)

        if f.endswith((".swift", ".kt", ".java")):
            lang = "Swift" if f.endswith(".swift") else ("Kotlin" if f.endswith(".kt") else "Java")
            desc = _describe_file(f, types, imports, all_type_names)
            deps = dependencies.get(f, [])
            type_list = [{"name": t["name"], "kind": t["kind"], "conformances": t.get("conformances", []),
                          "description": t.get("description", ""),
                          "properties_count": len(t.get("properties", [])),
                          "methods_count": len(t.get("methods", []))} for t in types]

            file_summaries.append({
                "path": rel_path,
                "description": desc,
                "language": lang,
                "imports": imports,
                "types": type_list,
                "depends_on": deps,
                "lines": file_contents.get(f, "").count("\n") + 1,
                "last_modified": datetime.fromtimestamp(os.path.getmtime(f)).isoformat()
            })
        else:
            file_summaries.append({
                "path": rel_path,
                "description": f"{os.path.splitext(f)[1]} 资源文件",
                "language": "ObjC" if f.endswith((".m", ".h", ".mm")) else "Other",
                "imports": [],
                "types": [],
                "depends_on": [],
                "lines": 0,
                "last_modified": datetime.fromtimestamp(os.path.getmtime(f)).isoformat()
            })

    # Group into modules by semantic analysis
    modules = _build_modules(file_summaries)

    # Find xcodeproj/workspace
    xcode_files = []
    for root, dirs, _ in os.walk(abs_path):
        dirs[:] = [d for d in dirs if not d.startswith(".") and d not in ("build", "DerivedData", "__pycache__", "Pods")]
        for d in dirs:
            if d.endswith((".xcodeproj", ".xcworkspace")):
                xcode_files.append(os.path.join(root, d))
    project_file = os.path.relpath(xcode_files[0], abs_path) if xcode_files else None

    summary = {
        "project_path": abs_path,
        "project_name": os.path.basename(abs_path),
        "last_updated": datetime.now().isoformat(),
        "language": _detect_language(source_files),
        "architecture": _detect_architecture(file_types, file_contents),
        "code_style": _detect_code_style(file_contents),
        "patterns": _detect_patterns(file_types),
        "total_files": len(source_files),
        "swift_files": len([f for f in source_files if f.endswith(".swift")]),
        "objc_files": len([f for f in source_files if f.endswith((".m", ".h", ".mm"))]),
        "project_file": project_file,
        "files": file_summaries,
        "modules": modules,
        "build_info": {
            "last_build_result": None,
            "last_test_result": None,
            "last_build_time": None
        }
    }

    _save(summary)
    return summary


def _build_modules(file_summaries: list[dict]) -> list[dict]:
    """Group files into modules based on type names and dependencies."""
    module_map = {}

    for fs in file_summaries:
        path = fs["path"]
        basename = os.path.basename(path).replace(".swift", "").replace(".m", "").replace(".h", "")

        # Skip test files from module grouping (they go to a separate test group)
        if "Tests" in path or "UITests" in path:
            module_name = "Test"
        else:
            # Determine module name from primary type
            module_name = "Core"
            for t in fs.get("types", []):
                name = t["name"]
                # Strip common suffixes
                for suffix in ["View", "ViewModel", "Model", "Controller", "Cell"]:
                    if name.endswith(suffix) and len(name) > len(suffix):
                        candidate = name[:-len(suffix)]
                        if candidate:
                            module_name = candidate
                            break
                if module_name != "Core":
                    break

        if module_name not in module_map:
            module_map[module_name] = {"files": [], "description": ""}
        module_map[module_name]["files"].append(path)

    # Build module descriptions from file descriptions
    modules = []
    for name, data in sorted(module_map.items()):
        # Skip singleton Core (just AppDelegate/App struct) unless it's important
        if name == "Core" and len(data["files"]) <= 2:
            continue

        # Collect type descriptions, deduplicate and limit length
        type_descs = []
        seen = set()
        for fs in file_summaries:
            if fs["path"] in data["files"]:
                for t in fs.get("types", []):
                    desc = t.get("description", "")
                    if desc and desc not in seen:
                        seen.add(desc)
                        type_descs.append(desc)

        # Build concise description (first sentence of each unique desc, max 3)
        concise = []
        for desc in type_descs[:3]:
            # Take first clause (before first semicolon)
            first = desc.split("；")[0]
            concise.append(first)
        desc = "；".join(concise) if concise else f"包含 {len(data['files'])} 个文件"

        modules.append({
            "name": name,
            "description": desc,
            "files": sorted(data["files"]),
            "file_count": len(data["files"])
        })

    return modules


def load_summary(project_path: str) -> dict | None:
    """Load an existing summary if available and not stale."""
    path = _summary_path(project_path)
    if not os.path.exists(path):
        return None

    try:
        with open(path, "r", encoding="utf-8") as f:
            summary = json.load(f)

        last_updated = datetime.fromisoformat(summary.get("last_updated", "2000-01-01"))
        if (datetime.now() - last_updated).total_seconds() > 86400:
            return None

        return summary
    except Exception:
        return None


def update_summary(project_path: str, changes: dict) -> dict:
    """Update specific fields in the summary."""
    summary = load_summary(project_path) or generate_summary(project_path)

    for key, value in changes.items():
        if key == "build_info" and isinstance(value, dict):
            summary["build_info"].update(value)
        elif key == "files" and isinstance(value, list):
            summary["files"] = value
        elif key == "modules" and isinstance(value, list):
            summary["modules"] = value
        else:
            summary[key] = value

    summary["last_updated"] = datetime.now().isoformat()
    _save(summary)
    return summary


def _save(summary: dict) -> None:
    path = _summary_path(summary["project_path"])
    with open(path, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)


def get_summary_for_prompt(project_path: str) -> str:
    """Get a concise text summary suitable for injecting into an agent prompt."""
    summary = load_summary(project_path)
    if not summary:
        summary = generate_summary(project_path)

    lines = [
        f"项目: {summary['project_name']}",
        f"语言: {summary['language']}",
        f"架构: {summary['architecture']}",
        f"代码风格: {summary['code_style']['naming']}, {summary['code_style']['comments']}注释",
        f"常用模式: {', '.join(summary['patterns']) if summary['patterns'] else 'None'}",
        f"文件总数: {summary['total_files']} (Swift: {summary['swift_files']}, ObjC: {summary['objc_files']})",
        f"",
        f"=== 文件详情 ===",
    ]

    for fs in summary["files"]:
        if fs["path"].endswith("Tests.swift") or fs["path"].endswith("UITests.swift"):
            continue  # Skip test files in prompt context
        lines.append(f"")
        lines.append(f"📄 {fs['path']}")
        lines.append(f"   {fs['description']}")
        if fs.get("types"):
            for t in fs["types"]:
                conf = f" : {', '.join(t['conformances'])}" if t.get("conformances") else ""
                lines.append(f"   - {t['kind']} {t['name']}{conf} ({t.get('properties_count', 0)} 属性, {t.get('methods_count', 0)} 方法)")
        if fs.get("depends_on"):
            lines.append(f"   → 依赖: {', '.join(fs['depends_on'])}")

    if summary["modules"]:
        lines.append("")
        lines.append("=== 模块划分 ===")
        for mod in summary["modules"]:
            lines.append(f"")
            lines.append(f"📦 {mod['name']}")
            lines.append(f"   {mod['description']}")
            for f in mod["files"]:
                lines.append(f"   - {f}")

    if summary["build_info"]["last_build_result"]:
        lines.append("")
        lines.append(f"上次构建: {summary['build_info']['last_build_result']}")
        lines.append(f"上次测试: {summary['build_info']['last_test_result']}")

    return "\n".join(lines)


if __name__ == "__main__":
    import sys
    path = sys.argv[1] if len(sys.argv) > 1 else "./TestProject"
    s = generate_summary(path)
    print(json.dumps(s, ensure_ascii=False, indent=2))
