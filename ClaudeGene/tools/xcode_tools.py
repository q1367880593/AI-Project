import os
import subprocess
import glob


def find_workspace_or_project(directory: str) -> tuple[str, str]:
    """Returns (path, type) where type is 'workspace' or 'project'."""
    workspaces = glob.glob(os.path.join(directory, "*.xcworkspace"))
    if workspaces:
        return workspaces[0], "workspace"
    projects = glob.glob(os.path.join(directory, "*.xcodeproj"))
    if projects:
        return projects[0], "project"
    # Search one level deeper
    for entry in os.scandir(directory):
        if entry.is_dir():
            workspaces = glob.glob(os.path.join(entry.path, "*.xcworkspace"))
            if workspaces:
                return workspaces[0], "workspace"
            projects = glob.glob(os.path.join(entry.path, "*.xcodeproj"))
            if projects:
                return projects[0], "project"
    return "", ""


def find_schemes(project_path: str) -> list[str]:
    proj_path, proj_type = find_workspace_or_project(project_path)
    if not proj_path:
        return []
    flag = "-workspace" if proj_type == "workspace" else "-project"
    result = subprocess.run(
        ["xcodebuild", flag, proj_path, "-list"],
        capture_output=True, text=True, timeout=30
    )
    schemes = []
    in_schemes = False
    for line in result.stdout.splitlines():
        stripped = line.strip()
        if stripped == "Schemes:":
            in_schemes = True
            continue
        if in_schemes:
            if stripped == "" or stripped.endswith(":"):
                break
            schemes.append(stripped)
    return schemes


def run_xcodebuild(args: list[str], working_directory: str | None = None) -> dict:
    cmd = ["xcodebuild"] + args
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=600,
            cwd=working_directory
        )
        return {
            "returncode": result.returncode,
            "stdout": result.stdout[-8000:] if len(result.stdout) > 8000 else result.stdout,
            "stderr": result.stderr[-4000:] if len(result.stderr) > 4000 else result.stderr,
        }
    except subprocess.TimeoutExpired:
        return {"returncode": -1, "stdout": "", "stderr": "xcodebuild timed out after 600s"}
    except Exception as e:
        return {"returncode": -1, "stdout": "", "stderr": str(e)}


def dispatch_xcode_tool(tool_name: str, tool_input: dict) -> str:
    if tool_name == "run_xcodebuild":
        result = run_xcodebuild(tool_input["args"], tool_input.get("working_directory"))
        lines = [f"Return code: {result['returncode']}"]
        if result["stdout"]:
            lines.append(f"STDOUT:\n{result['stdout']}")
        if result["stderr"]:
            lines.append(f"STDERR:\n{result['stderr']}")
        return "\n".join(lines)
    return f"[ERROR] Unknown xcode tool: {tool_name}"
