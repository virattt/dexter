[English](README.md) | **简体中文**

# Dexter 🤖

Dexter 是一个自主金融研究代理，会在工作过程中进行思考、规划与学习。它通过任务规划、自我反思和实时市场数据来完成分析。可以把它理解为专为金融研究打造的 Claude Code。

<img width="1098" height="659" alt="Screenshot 2026-01-21 at 5 25 10 PM" src="https://github.com/user-attachments/assets/3bcc3a7f-b68a-4f5e-8735-9d22196ff76e" />

## 目录

- [👋 概览](#overview)
- [✅ 前置要求](#prerequisites)
- [💻 安装方法](#installation)
- [🚀 运行方式](#running)
- [📊 评估方法](#evaluation)
- [🐛 调试方法](#debugging)
- [📱 如何配合 WhatsApp 使用](#whatsapp)
- [🤝 如何贡献](#contributing)
- [📄 许可证](#license)

<a id="overview"></a>

## 👋 概览

Dexter 会把复杂的金融问题拆解成清晰、分步骤的研究计划。它利用实时市场数据执行这些任务，检查自己的结果，并不断改进，直到得出有信心且有数据支撑的答案。  

**核心能力：**
- **智能任务规划**：自动将复杂查询拆解为结构化的研究步骤
- **自主执行**：选择并执行合适的工具来获取金融数据
- **自我验证**：检查自身工作，并在任务完成前持续迭代
- **实时金融数据**：可访问利润表、资产负债表和现金流量表
- **安全特性**：内置循环检测和步骤上限，防止失控执行

[![Twitter Follow](https://img.shields.io/twitter/follow/virattt?style=social)](https://twitter.com/virattt) [![Discord](https://img.shields.io/badge/Discord-Join%20Server-5865F2?style=social&logo=discord)](https://discord.gg/jpGHv2XB6T)

<img width="1042" height="638" alt="Screenshot 2026-02-18 at 12 21 25 PM" src="https://github.com/user-attachments/assets/2a6334f9-863f-4bd2-a56f-923e42f4711e" />

<a id="prerequisites"></a>

## ✅ 前置要求

- [Bun](https://bun.com) 运行时（v1.0 或更高版本）
- OpenAI API key（获取地址见[这里](https://platform.openai.com/api-keys)）
- Financial Datasets API key（获取地址见[这里](https://financialdatasets.ai)）
- Exa API key（获取地址见[这里](https://exa.ai)）- 可选，用于网页搜索

#### 安装 Bun

如果你还没有安装 Bun，可以通过 curl 安装：

**macOS/Linux：**
```bash
curl -fsSL https://bun.com/install | bash
```

**Windows：**
```bash
powershell -c "irm bun.sh/install.ps1|iex"
```

安装完成后，重启终端并确认 Bun 已成功安装：
```bash
bun --version
```

<a id="installation"></a>

## 💻 安装方法

1. 克隆仓库：
```bash
git clone https://github.com/virattt/dexter.git
cd dexter
```

2. 使用 Bun 安装依赖：
```bash
bun install
```

3. 配置环境变量：
```bash
# Copy the example environment file
cp env.example .env

# Edit .env and add your API keys (if using cloud providers)
# OPENAI_API_KEY=your-openai-api-key
# ANTHROPIC_API_KEY=your-anthropic-api-key (optional)
# GOOGLE_API_KEY=your-google-api-key (optional)
# XAI_API_KEY=your-xai-api-key (optional)
# OPENROUTER_API_KEY=your-openrouter-api-key (optional)

# Institutional-grade market data for agents; AAPL, NVDA, MSFT are free
# FINANCIAL_DATASETS_API_KEY=your-financial-datasets-api-key

# (Optional) If using Ollama locally
# OLLAMA_BASE_URL=http://127.0.0.1:11434

# Web Search (Exa preferred, Tavily fallback)
# EXASEARCH_API_KEY=your-exa-api-key
# TAVILY_API_KEY=your-tavily-api-key
```

<a id="running"></a>

## 🚀 运行方式

以交互模式运行 Dexter：
```bash
bun start
```

或者使用带 watch 的开发模式：
```bash
bun dev
```

<a id="evaluation"></a>

## 📊 评估方法

Dexter 内置了一套评估系统，会使用金融问题数据集测试代理表现。评估通过 LangSmith 做追踪，并采用 LLM-as-judge 的方式来评分结果正确性。

**在全部问题上运行：**
```bash
bun run src/evals/run.ts
```

**在随机样本上运行：**
```bash
bun run src/evals/run.ts --sample 10
```

评估运行器会实时展示进度、当前问题以及动态准确率统计。结果会记录到 LangSmith 以便后续分析。

<a id="debugging"></a>

## 🐛 调试方法

Dexter 会把所有工具调用记录到 scratchpad 文件中，便于调试和历史追踪。每次查询都会在 `.dexter/scratchpad/` 下生成一个新的 JSONL 文件。

**Scratchpad 位置：**
```
.dexter/scratchpad/
├── 2026-01-30-111400_9a8f10723f79.jsonl
├── 2026-01-30-143022_a1b2c3d4e5f6.jsonl
└── ...
```

每个文件都包含按行分隔的 JSON 条目，用于跟踪：
- **init**：原始查询
- **tool_result**：每次工具调用的参数、原始结果和 LLM 摘要
- **thinking**：代理的推理步骤

**Scratchpad 条目示例：**
```json
{"type":"tool_result","timestamp":"2026-01-30T11:14:05.123Z","toolName":"get_income_statements","args":{"ticker":"AAPL","period":"annual","limit":5},"result":{...},"llmSummary":"Retrieved 5 years of Apple annual income statements showing revenue growth from $274B to $394B"}
```

这样你就可以轻松检查代理到底获取了哪些数据，以及它是如何理解这些结果的。

<a id="whatsapp"></a>

## 📱 如何配合 WhatsApp 使用

你可以把手机连接到网关，通过 WhatsApp 和 Dexter 对话。发送给你自己的消息会由 Dexter 处理，回复也会发送回同一个聊天窗口。

**快速开始：**
```bash
# Link your WhatsApp account (scan QR code)
bun run gateway:login

# Start the gateway
bun run gateway
```

然后打开 WhatsApp，进入你与自己的聊天窗口（给自己发消息），向 Dexter 提问即可。

关于详细的安装步骤、配置选项和故障排查，请查看 [WhatsApp Gateway README](src/gateway/channels/whatsapp/README.md)。

<a id="contributing"></a>

## 🤝 如何贡献

1. Fork 本仓库
2. 创建功能分支
3. 提交你的修改
4. 推送分支
5. 创建 Pull Request

**重要**：请尽量保持 Pull Request 小而聚焦。这样会更容易被审阅和合并。

<a id="license"></a>

## 📄 许可证

本项目基于 MIT License 发布。
