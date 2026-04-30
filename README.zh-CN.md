# Dexter 🤖

Dexter 是一个自主式金融研究智能体，它在工作过程中会思考、规划和学习。它通过任务规划、自我反思和实时市场数据进行金融分析。可以把它想象成专门为金融研究打造的 Claude Code。

<img width="1098" height="659" alt="Screenshot 2026-01-21 at 5 25 10 PM" src="https://github.com/user-attachments/assets/3bcc3a7f-b68a-4f5e-8735-9d22196ff76e" />

## 目录

- [👋 概述](#-概述)
- [✅ 前置条件](#-前置条件)
- [💻 如何安装](#-如何安装)
- [🚀 如何运行](#-如何运行)
- [📊 如何评估](#-如何评估)
- [🐛 如何调试](#-如何调试)
- [📱 如何配合 WhatsApp 使用](#-如何配合-whatsapp-使用)
- [🤝 如何贡献](#-如何贡献)
- [📄 许可证](#-许可证)


## 👋 概述

Dexter 将复杂的金融问题转化为清晰的分步骤研究计划。它使用实时市场数据运行这些任务，检查自身工作，并不断完善结果，直到获得一个有信心、有数据支撑的答案。

**核心能力：**
- **智能任务规划**：自动将复杂查询分解为结构化的研究步骤
- **自主执行**：选择并执行合适的工具来收集金融数据
- **自我验证**：检查自身工作并迭代直到任务完成
- **实时金融数据**：可访问利润表、资产负债表和现金流量表
- **安全功能**：内置循环检测和步骤限制，防止无限执行

[![Twitter Follow](https://img.shields.io/twitter/follow/virattt?style=social)](https://twitter.com/virattt) [![Discord](https://img.shields.io/badge/Discord-Join%20Server-5865F2?style=social&logo=discord)](https://discord.gg/jpGHv2XB6T)

<img width="1042" height="638" alt="Screenshot 2026-02-18 at 12 21 25 PM" src="https://github.com/user-attachments/assets/2a6334f9-863f-4bd2-a56f-923e42f4711e" />


## ✅ 前置条件

- [Bun](https://bun.com) 运行时（v1.0 或更高版本）
- OpenAI API 密钥（获取方式：[此处](https://platform.openai.com/api-keys)）
- Financial Datasets API 密钥（获取方式：[此处](https://financialdatasets.ai)）
- Exa API 密钥（获取方式：[此处](https://exa.ai)）- 可选，用于网络搜索

#### 安装 Bun

如果你还没有安装 Bun，可以使用 curl 安装：

**macOS/Linux：**
```bash
curl -fsSL https://bun.com/install | bash
```

**Windows：**
```bash
powershell -c "irm bun.sh/install.ps1|iex"
```

安装完成后，重启终端并验证 Bun 是否已安装：
```bash
bun --version
```

## 💻 如何安装

1. 克隆仓库：
```bash
git clone https://github.com/virattt/dexter.git
cd dexter
```

2. 使用 Bun 安装依赖：
```bash
bun install
```

3. 设置环境变量：
```bash
# 复制示例环境文件
cp env.example .env

# 编辑 .env 并添加你的 API 密钥（如果使用云服务提供商）
# OPENAI_API_KEY=your-openai-api-key
# ANTHROPIC_API_KEY=your-anthropic-api-key（可选）
# GOOGLE_API_KEY=your-google-api-key（可选）
# XAI_API_KEY=your-xai-api-key（可选）
# OPENROUTER_API_KEY=your-openrouter-api-key（可选）

# 机构级市场数据；AAPL、NVDA、MSFT 免费使用
# FINANCIAL_DATASETS_API_KEY=your-financial-datasets-api-key

#（可选）如果使用本地 Ollama
# OLLAMA_BASE_URL=http://127.0.0.1:11434

# 网络搜索（优先使用 Exa，回退使用 Tavily）
# EXASEARCH_API_KEY=your-exa-api-key
# TAVILY_API_KEY=your-tavily-api-key
```

## 🚀 如何运行

以交互模式运行 Dexter：
```bash
bun start
```

或使用开发模式：
```bash
bun dev
```

## 📊 如何评估

Dexter 包含一个评估套件，用于针对一组金融问题数据集测试智能体。评估使用 LangSmith 进行跟踪，并采用 LLM 即评判方法进行正确性评分。

**运行所有问题：**
```bash
bun run src/evals/run.ts
```

**运行随机抽样数据：**
```bash
bun run src/evals/run.ts --sample 10
```

评估运行器显示实时 UI，包括进度、当前问题和运行中的准确率统计。结果会记录到 LangSmith 以供分析。

## 🐛 如何调试

Dexter 将所有工具调用记录到草稿板文件中用于调试和历史跟踪。每个查询在 `.dexter/scratchpad/` 中创建一个新的 JSONL 文件。

**草稿板位置：**
```
.dexter/scratchpad/
├── 2026-01-30-111400_9a8f10723f79.jsonl
├── 2026-01-30-143022_a1b2c3d4e5f6.jsonl
└── ...
```

每个文件包含换行符分隔的 JSON 条目，记录：
- **init**：原始查询
- **tool_result**：每个工具调用及其参数、原始结果和 LLM 摘要
- **thinking**：智能体推理步骤

**草稿板条目示例：**
```json
{"type":"tool_result","timestamp":"2026-01-30T11:14:05.123Z","toolName":"get_income_statements","args":{"ticker":"AAPL","period":"annual","limit":5},"result":{...},"llmSummary":"Retrieved 5 years of Apple annual income statements showing revenue growth from $274B to $394B"}
```

这使得检查智能体收集的确切数据及其如何解释结果变得非常容易。

## 📱 如何配合 WhatsApp 使用

通过将手机链接到网关，你可以使用 WhatsApp 与 Dexter 聊天。你发送给自己的消息会由 Dexter 处理，响应会发送回同一个聊天。

**快速开始：**
```bash
# 链接你的 WhatsApp 账户（扫描二维码）
bun run gateway:login

# 启动网关
bun run gateway
```

然后打开 WhatsApp，进入你自己的聊天（给自己发消息），向 Dexter 提问。

有关详细设置说明、配置选项和故障排除，请参阅 [WhatsApp 网关 README](src/gateway/channels/whatsapp/README.md)。

## 🤝 如何贡献

1. Fork 仓库
2. 创建功能分支
3. 提交你的更改
4. 推送到分支
5. 创建 Pull Request

**重要提示**：请保持你的 Pull Request 小而专注。这将使审核和合并更加容易。


## 📄 许可证

本项目采用 MIT 许可证。
