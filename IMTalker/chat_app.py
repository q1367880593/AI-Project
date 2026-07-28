"""
租房经纪人 AI 陪练系统 - 客户模拟聊天服务
"""
import os
import json
import re
from pathlib import Path
import httpx
from flask import Flask, request, jsonify, render_template
from openai import OpenAI

app = Flask(__name__)

PROMPTS_DIR = Path(__file__).parent / "客户模拟" / "customer_prompts"


def parse_profile_name(dirname: str) -> dict:
    """解析目录名，如 '中等_20260728_135622' -> {difficulty, timestamp}"""
    parts = dirname.split("_", 1)
    return {
        "difficulty": parts[0],
        "timestamp": parts[1] if len(parts) > 1 else "",
        "dirname": dirname
    }


def parse_conversation(content: str) -> dict:
    """解析 conversation 文件，提取画像标签和对话内容"""
    result = {
        "customer_id": "",
        "agent_id": "",
        "biz_type": "",
        "turn_count": "",
        "tag_count": 0,
        "tags_detail": [],
        "matched_features": [],
        "dialogues": []
    }

    lines = content.split("\n")

    # 解析头部信息
    for line in lines:
        line = line.strip()
        if line.startswith("客户ID:"):
            result["customer_id"] = line.split(":", 1)[1].strip()
        elif line.startswith("经纪人ID:"):
            result["agent_id"] = line.split(":", 1)[1].strip()
        elif line.startswith("业务类型:"):
            result["biz_type"] = line.split(":", 1)[1].strip()
        elif line.startswith("对话轮次:"):
            result["turn_count"] = line.split(":", 1)[1].strip()
        elif line.startswith("标签匹配数:"):
            result["tag_count"] = int(line.split(":", 1)[1].strip())

    # 解析匹配到的画像特征
    in_features = False
    for line in lines:
        if "匹配到的画像特征" in line:
            in_features = True
            continue
        if in_features and line.strip().startswith("==="):
            break
        if in_features:
            match = re.search(r"(.+?):\s*(.+?)(?:\((.+?)\))?$", line.strip())
            if match and match.group(1).strip():
                feature = {
                    "dimension": match.group(1).strip(),
                    "value": match.group(2).strip(),
                    "label": match.group(3).strip() if match.group(3) else match.group(2).strip()
                }
                result["matched_features"].append(feature)

    # 解析对话内容
    in_dialogue = False
    for line in lines:
        if "【对话内容】" in line:
            in_dialogue = True
            continue
        if in_dialogue and line.strip():
            # 格式: [timestamp] 角色: 内容
            match = re.match(r"\[(.*?)\]\s*(客户|经纪人):\s*(.*)", line.strip())
            if match:
                result["dialogues"].append({
                    "time": match.group(1),
                    "role": "customer" if match.group(2) == "客户" else "agent",
                    "content": match.group(3)
                })

    return result


def get_all_profiles():
    """获取所有客户画像列表"""
    profiles = []
    if not PROMPTS_DIR.exists():
        return profiles

    for d in sorted(PROMPTS_DIR.iterdir()):
        if d.is_dir():
            info = parse_profile_name(d.name)
            # 读取 system_prompt 前几行获取画像概要
            sp_file = d / "system_prompt.txt"
            summary = ""
            if sp_file.exists():
                sp_content = sp_file.read_text(encoding="utf-8")
                # 提取画像特征行
                for line in sp_content.split("\n"):
                    line = line.strip()
                    if line.startswith("- 性格特征：") or line.startswith("- 租赁目的：") or line.startswith("- 决策模式："):
                        summary += line.lstrip("- ") + " | "
                summary = summary.rstrip(" | ")

            # 统计 conversation 文件
            conv_files = sorted([f for f in d.iterdir() if f.name.startswith("conversation_")])
            info["summary"] = summary
            info["conv_count"] = len(conv_files)
            info["id"] = d.name
            profiles.append(info)

    return profiles


def load_profile(profile_id: str):
    """加载指定客户画像的完整数据"""
    profile_dir = PROMPTS_DIR / profile_id
    if not profile_dir.exists():
        return None

    data = {
        "id": profile_id,
        "system_prompt": "",
        "conversations": []
    }

    sp_file = profile_dir / "system_prompt.txt"
    if sp_file.exists():
        data["system_prompt"] = sp_file.read_text(encoding="utf-8")

    # 读取 conversation 文件
    for f in sorted(profile_dir.iterdir()):
        if f.name.startswith("conversation_"):
            content = f.read_text(encoding="utf-8")
            data["conversations"].append({
                "filename": f.name,
                "parsed": parse_conversation(content)
            })

    return data


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/profiles")
def api_profiles():
    profiles = get_all_profiles()
    # 按难度分组
    grouped = {}
    for p in profiles:
        diff = p["difficulty"]
        if diff not in grouped:
            grouped[diff] = []
        grouped[diff].append(p)
    return jsonify({"profiles": profiles, "grouped": grouped})


@app.route("/api/profile/<path:profile_id>")
def api_profile(profile_id):
    data = load_profile(profile_id)
    if data is None:
        return jsonify({"error": "Profile not found"}), 404
    return jsonify(data)


@app.route("/api/chat", methods=["POST"])
def api_chat():
    """与客户模拟 Agent 对话"""
    body = request.json
    api_key = body.get("api_key", "")
    api_base = body.get("api_base", "https://api.openai.com/v1")
    model = body.get("model", "gpt-4o")
    system_prompt = body.get("system_prompt", "")
    messages = body.get("messages", [])

    if not api_key:
        api_key = "ollama"  # Ollama 本地不需要真实 key
    if not system_prompt:
        return jsonify({"error": "请先选择客户画像"}), 400

    try:
        client = OpenAI(api_key=api_key, base_url=api_base, http_client=httpx.Client(trust_env=False))

        # 构建完整的消息列表
        full_messages = [
            {"role": "system", "content": system_prompt}
        ]
        # 前 20 条消息
        full_messages.extend(messages[-20:])

        response = client.chat.completions.create(
            model=model,
            messages=full_messages,
            temperature=0.8,
            max_tokens=1024
        )

        raw_content = response.choices[0].message.content.strip()

        # 尝试解析 JSON 响应
        try:
            # 提取 JSON 块
            json_match = re.search(r'\{[\s\S]*\}', raw_content)
            if json_match:
                parsed = json.loads(json_match.group())
                return jsonify({
                    "response": parsed.get("response", raw_content),
                    "action": parsed.get("action", "chat"),
                    "action_reason": parsed.get("action_reason", ""),
                    "raw": raw_content
                })
            else:
                return jsonify({
                    "response": raw_content,
                    "action": "chat",
                    "action_reason": "",
                    "raw": raw_content
                })
        except json.JSONDecodeError:
            return jsonify({
                "response": raw_content,
                "action": "chat",
                "action_reason": "",
                "raw": raw_content
            })

    except Exception as e:
        error_msg = str(e)
        return jsonify({"error": f"API 调用失败: {error_msg}"}), 500


if __name__ == "__main__":
    os.makedirs("templates", exist_ok=True)
    app.run(host="127.0.0.1", port=7788, debug=True)