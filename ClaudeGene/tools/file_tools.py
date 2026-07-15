import os
import re
import subprocess


def read_file(path: str) -> str:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return f"[ERROR] File not found: {path}"
    except Exception as e:
        return f"[ERROR] Could not read {path}: {e}"


def write_file(path: str, content: str) -> bool:
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    return True


def list_files(directory: str, extensions: list[str] | None = None) -> list[str]:
    result = []
    for root, dirs, files in os.walk(directory):
        # Skip hidden dirs and common noise
        dirs[:] = [d for d in dirs if not d.startswith(".") and d not in ("build", "DerivedData", "__pycache__")]
        for fname in files:
            if fname.startswith("."):
                continue
            if extensions:
                if any(fname.endswith(ext) for ext in extensions):
                    result.append(os.path.join(root, fname))
            else:
                result.append(os.path.join(root, fname))
    return result


def search_files(pattern: str, directory: str, extensions: list[str] | None = None) -> list[dict]:
    results = []
    files = list_files(directory, extensions)
    try:
        compiled = re.compile(pattern)
    except re.error:
        compiled = re.compile(re.escape(pattern))

    for fpath in files:
        try:
            with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                for lineno, line in enumerate(f, 1):
                    if compiled.search(line):
                        results.append({"file": fpath, "line": lineno, "content": line.rstrip()})
        except Exception:
            continue
    return results


def dispatch_file_tool(tool_name: str, tool_input: dict) -> str:
    if tool_name == "read_file":
        return read_file(tool_input["path"])
    elif tool_name == "write_file":
        ok = write_file(tool_input["path"], tool_input["content"])
        return f"Written: {tool_input['path']}" if ok else f"Failed to write: {tool_input['path']}"
    elif tool_name == "list_files":
        files = list_files(tool_input["directory"], tool_input.get("extensions"))
        return "\n".join(files) if files else "(no files found)"
    elif tool_name == "search_files":
        hits = search_files(tool_input["pattern"], tool_input["directory"], tool_input.get("extensions"))
        if not hits:
            return "(no matches)"
        return "\n".join(f"{h['file']}:{h['line']}: {h['content']}" for h in hits[:50])
    return f"[ERROR] Unknown file tool: {tool_name}"
