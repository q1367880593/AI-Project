# 租房经纪人 AI 陪练系统

基于 AI 客户模拟的租房经纪人对话训练工具，支持选择不同难度和画像的虚拟客户进行自由对练。

## 前置条件

- Python 3.10+
- 本地 LLM 服务（如 Ollama）或 OpenAI 兼容 API

## 快速开始

```bash
# 1. 创建虚拟环境
python3 -m venv venv
source venv/bin/activate

# 2. 安装依赖
pip install flask openai httpx

# 3. 启动服务
python chat_app.py
```

浏览器打开 `http://127.0.0.1:7788`。

## 使用方式

1. 确认 LLM 服务已运行（如 `ollama serve`）
2. 在左侧"API 配置"中填写 API 地址和模型名称（Ollama 默认 `http://localhost:11434/v1`，Key 留空即可）
3. 选择难度和客户画像，点击开始对话
4. 右侧"真实会话参考"面板可查看匹配该客户画像的真实客服对话记录
5. 点击顶部"Prompt"按钮可查看当前客户的完整模拟提示词

## 项目结构

```
IMTalker/
├── chat_app.py              # Flask 后端服务
├── templates/
│   └── index.html           # 前端聊天界面
├── 客户模拟/
│   └── customer_prompts/    # 客户画像数据
│       ├── 入门_xxx/         # 难度级别目录
│       │   ├── system_prompt.txt          # 客户模拟提示词
│       │   └── conversation_*.txt         # 真实会话参考
│       ├── 中等_xxx/
│       ├── 中高_xxx/
│       └── 高等_xxx/
└── 原型设计/
    └── rental-agent-training-prototype.html  # 原始原型设计
```

## 添加新客户画像

在 `客户模拟/customer_prompts/` 下新建目录，命名格式为 `{难度}_{时间戳}`，放入两个文件：

- **system_prompt.txt** — 客户模拟提示词，定义客户画像特征、行为参数、对话规则
- **conversation_*.txt** — 真实客服对话记录，用于参考

目录创建后刷新页面即可看到新客户。