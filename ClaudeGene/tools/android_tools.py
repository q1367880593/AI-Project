"""Android project tools — Gradle, manifest parsing, project scanning."""

import os
import subprocess
import xml.etree.ElementTree as ET


def find_gradle_project(directory: str) -> tuple[str, str]:
    """Find build.gradle or build.gradle.kts in the directory.
    Returns (app_build_gradle_path, level) where level is 'app' or 'root'.
    Prefers app-level build.gradle over root-level."""
    abs_dir = os.path.abspath(directory)

    # Check app/ subdirectory first (standard Android structure)
    for name in ("build.gradle.kts", "build.gradle"):
        path = os.path.join(abs_dir, "app", name)
        if os.path.isfile(path):
            return path, "app"

    # Fallback to root level
    for name in ("build.gradle.kts", "build.gradle"):
        path = os.path.join(abs_dir, name)
        if os.path.isfile(path):
            return path, "root"

    return "", ""


def find_manifest(directory: str) -> str:
    """Find AndroidManifest.xml in the project."""
    abs_dir = os.path.abspath(directory)
    candidates = [
        os.path.join(abs_dir, "app", "src", "main", "AndroidManifest.xml"),
        os.path.join(abs_dir, "src", "main", "AndroidManifest.xml"),
    ]
    for c in candidates:
        if os.path.isfile(c):
            return c
    return ""


def get_app_version(manifest_path: str) -> dict:
    """Extract versionCode and versionName from AndroidManifest.xml or build.gradle."""
    result = {"version_code": "", "version_name": "", "package": ""}

    if manifest_path and os.path.isfile(manifest_path):
        try:
            tree = ET.parse(manifest_path)
            root = tree.getroot()
            # Android namespace
            ns = {"android": "http://schemas.android.com/apk/res/android"}
            result["package"] = root.get("package", "")
            result["version_code"] = root.get("{http://schemas.android.com/apk/res/android}versionCode", "")
            result["version_name"] = root.get("{http://schemas.android.com/apk/res/android}versionName", "")
        except Exception:
            pass

    return result


def get_gradle_versions(build_gradle_path: str) -> dict:
    """Extract version info from app/build.gradle.kts by reading the file."""
    result = {"version_code": "", "version_name": "", "application_id": ""}
    if not os.path.isfile(build_gradle_path):
        return result

    try:
        with open(build_gradle_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Extract versionCode
        vc_match = __import__('re').search(r'versionCode\s*=\s*(\d+)', content)
        if vc_match:
            result["version_code"] = vc_match.group(1)

        # Extract versionName
        vn_match = __import__('re').search(r'versionName\s*=\s*"([^"]+)"', content)
        if vn_match:
            result["version_name"] = vn_match.group(1)

        # Extract applicationId
        aid_match = __import__('re').search(r'applicationId\s*=\s*"([^"]+)"', content)
        if aid_match:
            result["application_id"] = aid_match.group(1)

    except Exception:
        pass

    return result


def run_gradle(args: list[str], working_directory: str | None = None) -> dict:
    """Run ./gradlew with given arguments."""
    cmd = ["./gradlew"] + args
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
        return {"returncode": -1, "stdout": "", "stderr": "gradle timed out after 600s"}
    except Exception as e:
        return {"returncode": -1, "stdout": "", "stderr": str(e)}


def dispatch_android_tool(tool_name: str, tool_input: dict) -> str:
    if tool_name == "run_gradle":
        result = run_gradle(tool_input["args"], tool_input.get("working_directory"))
        lines = [f"Return code: {result['returncode']}"]
        if result["stdout"]:
            lines.append(f"STDOUT:\n{result['stdout']}")
        if result["stderr"]:
            lines.append(f"STDERR:\n{result['stderr']}")
        return "\n".join(lines)
    return f"[ERROR] Unknown Android tool: {tool_name}"
