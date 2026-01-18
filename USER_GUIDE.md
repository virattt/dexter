# Dexter User Manual

**Version**: 3.0.0
**Last Updated**: 2026-01-18

## Table of Contents

1. [Introduction & Overview](#1-introduction--overview)
2. [Installation & Setup](#2-installation--setup)
3. [Quick Start Guide](#3-quick-start-guide)
4. [User Guide - Commands & Features](#4-user-guide---commands--features)
5. [Configuration](#5-configuration)
6. [Developer Guide](#6-developer-guide)
7. [Troubleshooting](#7-troubleshooting)
8. [FAQ](#8-faq)

---

## Quick Reference

**Essential Commands**

| Command | Action |
|---------|--------|
| Type `exit` or `quit` | Close the application |
| `/model` | Switch AI model/provider |
| `Ctrl+C` | Cancel current operation |
| `Escape` | Cancel a running query |

**Getting Help**

- Check this USER_GUIDE.md for detailed documentation
- Visit [GitHub Issues](https://github.com/virattt/dexter/issues) for bugs and feature requests

---

## 1. Introduction & Overview

### What is Dexter?

Dexter is an autonomous financial research AI agent that uses task planning, self-reflection, and real-time market data to perform complex financial analysis. Think of it as "Claude Code for financial research" - it breaks down complex questions into structured research plans, executes them step by step, and validates its own work before delivering confident, data-backed answers.

### Key Capabilities

- **Intelligent Task Planning**: Automatically decomposes complex queries into structured research steps
- **Autonomous Execution**: Selects and executes the right tools to gather financial data
- **Self-Validation**: Checks its own work and iterates until tasks are complete
- **Real-Time Financial Data**: Access to income statements, balance sheets, cash flow statements, SEC filings, price data, crypto markets, and news
- **Safety Features**: Built-in loop detection and step limits to prevent runaway execution

### What Makes Dexter Different

Unlike generic AI assistants, Dexter:
- Has specialized tools for financial data from reliable sources like SEC filings
- Uses a structured planning approach to ensure comprehensive analysis
- Validates its own work to ensure accuracy before presenting answers
- Provides transparent visibility into its thinking process

### Tech Stack

- **Runtime**: [Bun](https://bun.sh) v1.0+ (fast JavaScript runtime)
- **UI Framework**: React + Ink (terminal user interface)
- **LLM Integration**: LangChain.js with multi-provider support
- **Language**: TypeScript
- **Data Sources**: Financial Datasets API, Tavily Search

### Target Audience

- **End Users**: Financial analysts, investors, researchers who need deep financial analysis
- **Developers**: Contributors who want to extend Dexter's capabilities or fix bugs

---

## 2. Installation & Setup

### Prerequisites

Before installing Dexter, ensure you have:

- **Bun Runtime**: v1.0 or higher (install instructions below)
- **API Keys**:
  - At least one LLM provider key: OpenAI, Anthropic, or Google
  - Financial Datasets API key (required for financial data)
  - Tavily API key (optional, for web search capability)

### Installing Bun

Bun is a fast JavaScript runtime and package manager. Install it using the appropriate command for your platform:

**macOS/Linux:**
```bash
curl -fsSL https://bun.sh/install | bash
```

**Windows:**
```bash
powershell -c "irm bun.sh/install.ps1|iex"
```

After installation, restart your terminal and verify:
```bash
bun --version
```

### Cloning and Installing Dexter

1. Clone the repository:
```bash
git clone https://github.com/virattt/dexter.git
cd dexter
```

2. Install dependencies:
```bash
bun install
```

### Environment Configuration

1. Copy the example environment file:
```bash
cp env.example .env
```

2. Edit the `.env` file and add your API keys:

```bash
# LLM Provider Keys (at least one required)
OPENAI_API_KEY=your-openai-api-key-here
# ANTHROPIC_API_KEY=your-anthropic-api-key-here
# GOOGLE_API_KEY=your-google-api-key-here

# Optional: For local Ollama
# OLLAMA_BASE_URL=http://127.0.0.1:11434

# Required: Financial Data Access
FINANCIAL_DATASETS_API_KEY=your-financial-datasets-api-key-here

# Optional: Web Search
# TAVILY_API_KEY=your-tavily-api-key-here
```

### Obtaining API Keys

- **OpenAI**: Get your key at [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- **Anthropic**: Get your key at [https://console.anthropic.com/](https://console.anthropic.com/)
- **Google**: Get your key at [https://makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey)
- **Financial Datasets**: Get your key at [https://financialdatasets.ai](https://financialdatasets.ai)
- **Tavily**: Get your key at [https://tavily.com](https://tavily.com)

### Verification

Run Dexter to verify your installation:
```bash
bun start
```

You should see the welcome screen displaying your current provider and model.

### Post-Install Checklist

- [ ] Bun is installed and accessible (`bun --version` works)
- [ ] Dependencies installed successfully (`bun install` completed)
- [ ] `.env` file created with at least one LLM API key
- [ ] Financial Datasets API key configured
- [ ] Dexter starts without errors

---

## 3. Quick Start Guide

### First Run

When you run `bun start`, you'll see a welcome screen showing:
- Current provider (e.g., "OpenAI")
- Current model (e.g., "gpt-4.1")
- A prompt waiting for your input

```
┌─────────────────────────────────────────┐
│  Dexter - Financial Research Agent      │
│  Provider: OpenAI | Model: gpt-4.1     │
└─────────────────────────────────────────┘

> _
```

### Your First Query

Try this simple example:

```
> What was Apple's revenue in the latest quarter?
```

Dexter will:
1. **Plan**: Break down your query into research tasks
2. **Execute**: Fetch Apple's latest income statement
3. **Validate**: Verify the data is complete
4. **Answer**: Present the revenue figure with context

> **🛑 How to Exit**: Type `exit` or `quit` and press Enter to close Dexter.

### Understanding the Interface

**Chat Input Area**: The `>` prompt where you type questions

**Working Indicator**: Shows while Dexter is thinking:
```
⠋ Planning research tasks...
⠙ Fetching income statement for AAPL...
⠹ Analyzing data...
```

**Final Answer**: Displayed clearly at the end with supporting data

### Basic Navigation

- **Up/Down Arrow Keys**: Navigate through your command history
- **Ctrl+C**: Exit Dexter (or cancel current operation)
- **Escape**: Cancel a running query
- **Type `exit` or `quit`**: Close the application

### Model Switching

You can switch between LLM providers by typing:
```
> /model
```

This opens an interactive menu to select a different provider. (See Configuration section for details)

### Next Steps

Once you're comfortable with basic queries, explore:
- Section 4 for all commands and features
- Section 5 for configuration options
- Section 6 for developer documentation

---

## 4. User Guide - Commands & Features

### Slash Commands

#### `/model` - Switch LLM Provider

Change the AI model Dexter uses for reasoning.

```
> /model
```

This opens an interactive selection screen:
- Choose a provider (OpenAI, Anthropic, Google, Ollama)
- Select a specific model from that provider
- Provide API key if prompted

**Available Providers:**
- **OpenAI**: GPT-4.1 (fast, cost-effective)
- **Anthropic**: Claude Sonnet 4.5 (deep analysis)
- **Google**: Gemini 3 (cost-efficient)
- **Ollama**: Local models (privacy, offline)

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+C` | Exit Dexter, or cancel current operation |
| `Escape` | Cancel selection flow or running agent |
| `Up Arrow` | Navigate to previous command in history |
| `Down Arrow` | Navigate to next command in history |
| `Enter` | Submit your query |
| Type `exit` or `quit` | Close the application |

### Query Types

Dexter supports various types of financial queries:

#### Financial Statement Analysis

```
> What was Tesla's operating margin trend over the past 4 quarters?
> Show me Microsoft's revenue growth year over year
> What is Amazon's debt-to-equity ratio based on recent financials?
```

#### Multi-Company Comparisons

```
> Compare Microsoft and Google's cash positions
> Which has better profitability: Apple or Meta?
> Compare the P/E ratios of NVDA, AMD, and Intel
```

#### Crypto Analysis

```
> What's Bitcoin's price movement this week?
> Compare Ethereum and Solana market caps
> Show me the top 5 cryptocurrencies by volume
```

#### News-Driven Research

```
> How did Meta's stock react to their latest earnings?
> What news has been affecting Tesla's stock lately?
> Show me recent insider trading activity for Apple
```

#### Advanced Research

```
> Analyze the fundamental trends in Netflix's business
> What are the key risk factors mentioned in Apple's latest 10-K?
> Break down Google's revenue by segment for the past year
```

### Understanding Agent Output

Dexter provides transparent visibility into its work:

**1. Planning Phase:**
```
⠙ Planning: Breaking down query into tasks
```

**2. Execution Phase:**
```
✓ get_income_statements(ticker=AAPL, period=quarter, limit=4)
✓ get_balance_sheets(ticker=AAPL, period=annual, limit=1)
```

**3. Answer Phase:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Analysis Complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Apple's revenue in the latest quarter (Q4 2024) was
$119.6 billion, representing a 2.1% year-over-year increase...

[Data sources and metrics shown]
```

### Best Practices

1. **Be Specific**: "What was Apple's Q4 2024 revenue?" is better than "How much money did Apple make?"
2. **Use Company Names**: "Microsoft" works better than just "MSFT" for context
3. **Specify Time Ranges**: "over the past 4 quarters" helps Dexter fetch the right data
4. **Ask Follow-ups**: You can build on previous answers for deeper analysis
5. **Be Patient**: Complex queries may require multiple tool calls and iterations

### Available Data Tools

Dexter has access to these financial tools:
- **Income Statements**: Revenue, expenses, net income
- **Balance Sheets**: Assets, liabilities, equity
- **Cash Flow Statements**: Operating, investing, financing activities
- **SEC Filings**: 10-K, 10-Q, 8-K filings with full text
- **Price Data**: Real-time and historical stock prices
- **Crypto Data**: Cryptocurrency prices and market data
- **Financial Metrics**: P/E, debt ratios, margins, and more
- **News**: Recent news articles for context
- **Analyst Estimates**: Market expectations and targets
- **Segmented Revenues**: Revenue by business segment
- **Insider Trades**: Recent insider buying/selling activity

---

## 5. Configuration

### Environment Variables

Dexter uses a `.env` file for configuration. Copy `env.example` to `.env` and configure:

#### Required Variables

```bash
# At least one LLM provider key is required
OPENAI_API_KEY=sk-your-key-here
# OR
ANTHROPIC_API_KEY=sk-ant-your-key-here
# OR
GOOGLE_API_KEY=your-google-key-here

# Required for financial data
FINANCIAL_DATASETS_API_KEY=your-fd-key-here
```

#### Optional Variables

```bash
# For local Ollama (alternative to cloud providers)
OLLAMA_BASE_URL=http://127.0.0.1:11434

# For web search capability
TAVILY_API_KEY=your-tavily-key-here
```

### Model Selection

Use the `/model` command to switch between LLM providers interactively.

**Selection Flow:**
1. Type `/model`
2. Select a provider from the list
3. Choose a specific model from that provider
4. If API key is missing, you'll be prompted to enter it

### Provider Comparison

| Provider | Best For | Speed | Cost |
|----------|----------|-------|------|
| **OpenAI** | General analysis, quick queries | Fast | Medium |
| **Anthropic** | Deep analysis, complex reasoning | Medium | Higher |
| **Google** | Cost-effective research | Fast | Lower |
| **Ollama** | Privacy, offline use | Varies | Free (local) |

### Advanced Configuration

For developers, Dexter has additional configuration options in the code:

- **maxIterations**: Maximum number of agent iterations (default: 10)
  - Located in `src/cli.tsx`
  - Adjust if you need longer or shorter analysis chains

### API Key Management

**Where Keys Are Stored:**
- Keys are stored in the `.env` file in your project directory
- The `.env` file is never committed to git (see `.gitignore`)

**How Dexter Handles Missing Keys:**
- When you select a provider via `/model`, if the key is missing, Dexter will prompt you to enter it
- You can choose to save it to `.env` for future use

**Updating Keys:**
- Simply edit your `.env` file and restart Dexter
- No need to reinstall or reconfigure

---

## 6. Developer Guide

### Architecture Overview

Dexter uses a multi-agent architecture:

```
┌─────────────────────────────────────────────────────────┐
│                    User Query                           │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              Planning Agent                              │
│  - Analyzes query                                       │
│  - Creates structured task list                         │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              Action Agent                                │
│  - Selects appropriate tools                           │
│  - Executes research steps                             │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│            Validation Agent                              │
│  - Verifies task completion                            │
│  - Checks data sufficiency                             │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              Answer Agent                                │
│  - Synthesizes findings                                │
│  - Formats comprehensive response                      │
└─────────────────────────────────────────────────────────┘
```

### Project Structure

```
dexter/
├── src/
│   ├── agent/           # Core agent logic
│   │   ├── agent.ts     # Main agent orchestration
│   │   └── prompts.ts   # LLM prompts for each agent
│   ├── tools/           # Financial data tools
│   │   ├── finance/     # Specific financial tools
│   │   └── registry.ts  # Tool registry and execution
│   ├── components/      # React/Ink UI components
│   │   ├── Input.tsx
│   │   ├── ModelSelector.tsx
│   │   └── AgentEventView.tsx
│   ├── hooks/           # Custom React hooks
│   │   ├── useAgentRunner.ts
│   │   ├── useModelSelection.ts
│   │   └── useInputHistory.ts
│   ├── model/           # LLM provider integrations
│   │   └── llm.ts
│   ├── utils/           # Utility functions
│   └── cli.tsx          # Main CLI component
├── package.json
├── tsconfig.json
└── README.md
```

### Adding New Tools

To add a new financial tool:

1. **Create the tool file** in `src/tools/finance/`:
```typescript
// src/tools/finance/my-tool.ts
import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export const myNewTool = new StructuredTool({
  name: 'my_new_tool',
  description: 'Description of what this tool does',
  schema: z.object({
    param1: z.string().describe('Parameter description'),
  }),
  func: async ({ param1 }) => {
    // Your tool logic here
    return JSON.stringify(result);
  },
});
```

2. **Register the tool** in `src/tools/registry.ts`:
```typescript
import { myNewTool } from './finance/my-tool.js';

export const TOOL_REGISTRY: Record<string, StructuredToolInterface> = {
  // ... existing tools
  my_new_tool: myNewTool,
};
```

3. **Export from index** if needed:
```typescript
// src/tools/finance/index.ts
export { myNewTool } from './my-tool.js';
```

### Development Workflow

```bash
# Start in watch mode (auto-restart on changes)
bun dev

# Type checking
bun run typecheck

# Run tests
bun test

# Run tests in watch mode
bun run test:watch

# Start normally
bun start
```

### Testing

Tests are located alongside source files. Run tests with:
```bash
bun test
```

### Contributing Guidelines

1. **Fork the repository** on GitHub
2. **Create a feature branch**: `git checkout -b my-feature`
3. **Make your changes** with clear, focused commits
4. **Run tests**: `bun test` and `bun run typecheck`
5. **Push to your branch**: `git push origin my-feature`
6. **Create a Pull Request** on GitHub

**Keep PRs Small and Focused:**
- One feature or bug fix per PR
- Clear commit messages
- Include tests for new functionality
- Update documentation as needed

### Code Style

- Use TypeScript for type safety
- Follow existing code patterns
- Use Zod schemas for tool validation
- Keep functions focused and modular
- Add comments for complex logic

---

## 7. Troubleshooting

### API Key Issues

#### "Invalid API key" Error

**Symptoms**: Error message about invalid or missing API key

**Solutions**:
1. Verify your `.env` file has the correct key
2. Check for typos in the key name or value
3. Ensure the key hasn't expired or been revoked
4. Try regenerating the key from the provider's dashboard

#### Missing Key Prompt

**Symptoms**: Dexter asks for an API key during model selection

**Solutions**:
1. Enter the key when prompted (will be saved to `.env`)
2. Or add it manually to your `.env` file
3. Restart Dexter after adding the key

### Installation Problems

#### "bun: command not found"

**Symptoms**: Command not found when running `bun`

**Solutions**:
1. Verify Bun is installed: `which bun`
2. If not found, reinstall Bun using the installation commands
3. Ensure Bun is in your PATH
4. Try restarting your terminal

#### `bun install` Fails

**Symptoms**: Errors during dependency installation

**Solutions**:
1. Delete `node_modules` folder: `rm -rf node_modules`
2. Delete `bun.lock`: `rm bun.lock`
3. Reinstall: `bun install`
4. Ensure you have a stable internet connection

#### TypeScript Errors

**Symptoms**: Type checking fails

**Solutions**:
1. Run `bun run typecheck` to see specific errors
2. Ensure you're using the correct TypeScript version
3. Delete and reinstall dependencies
4. Check that your Node.js/Bun version is compatible

### Runtime Issues

#### Agent Stuck or Looping

**Symptoms**: Agent keeps running without producing output

**Solutions**:
1. Press `Escape` to cancel the current operation
2. Press `Ctrl+C` to force exit
3. Try rephrasing your query to be more specific
4. Check the debug panel for what the agent is doing

#### No Response from LLM

**Symptoms**: Query submitted but no response

**Solutions**:
1. Check if the LLM provider's API is operational
2. Verify your API key has available credits
3. Try switching to a different provider using `/model`
4. Check your internet connection

#### Financial Data Errors

**Symptoms**: "Error fetching financial data" or similar

**Solutions**:
1. Verify `FINANCIAL_DATASETS_API_KEY` is correct
2. Check if your API key has reached rate limits
3. Ensure the ticker symbol is valid
4. Try a different query to isolate the issue

### Model-Specific Issues

#### Ollama Connection Refused

**Symptoms**: "Failed to connect to Ollama" error

**Solutions**:
1. Ensure Ollama is running: `ollama list`
2. Check `OLLAMA_BASE_URL` in `.env` (default: `http://127.0.0.1:11434`)
3. Verify Ollama is installed correctly
4. Try pulling the model: `ollama pull <model-name>`

#### Rate Limiting

**Symptoms**: "Rate limit exceeded" or slow responses

**Solutions**:
1. Wait a few minutes before retrying
2. Switch to a different provider using `/model`
3. Check your API plan's rate limits
4. Consider upgrading your API plan

### Getting Help

If you're still stuck:

1. **Check GitHub Issues**: [https://github.com/virattt/dexter/issues](https://github.com/virattt/dexter/issues)
2. **Create a New Issue**: Include:
   - Error messages (full text)
   - Your OS and version
   - Bun version (`bun --version`)
   - Steps to reproduce
   - What you expected vs. what happened

---

## 8. FAQ

### General Questions

**Q: Is Dexter free to use?**

A: Dexter itself is open-source and free (MIT license). However, you pay for:
- LLM API usage (OpenAI, Anthropic, Google) based on their pricing
- Financial Datasets API (they offer free and paid tiers)
- Tavily API if you use web search (has a free tier)

**Q: What data sources does Dexter use?**

A: Dexter uses:
- **Financial Datasets API**: SEC filings, financial statements, market data
- **Tavily Search**: Web search for news and additional context
- **LLM Providers**: For reasoning and analysis (OpenAI, Anthropic, Google, Ollama)

**Q: Can I use Dexter offline?**

A: Partially. You can use Ollama for the LLM component offline, but:
- Financial data requires internet (Financial Datasets API)
- Web search requires internet (Tavily API)
- Initial setup requires internet for installation

### Usage Questions

**Q: How accurate is the financial data?**

A: Data comes from SEC filings and reliable financial sources. However:
- Always verify critical investment decisions
- Data may have slight delays from real-time market prices
- Historical data is generally very accurate

**Q: Can Dexter trade stocks?**

A: No. Dexter is a research and analysis tool only. It does not:
- Execute trades
- Connect to brokerage accounts
- Provide investment advice (it provides analysis, not advice)

**Q: What companies can I analyze?**

A: You can analyze:
- Any public company with SEC filings (US markets)
- Popular cryptocurrencies
- Companies with data available through Financial Datasets API

For international companies, availability varies by data source.

**Q: How current is the data?**

A: Data freshness varies:
- **Price data**: Near real-time (small delays)
- **Financial statements**: As filed with SEC (quarterly/annual)
- **News**: Recent articles via Tavily Search
- **Filings**: Available as soon as filed with SEC

### Technical Questions

**Q: Why Bun instead of Node.js?**

A: Bun offers several advantages:
- **Faster**: Much faster startup and execution
- **Built-in package manager**: No need for npm/yarn
- **Compatible**: Drops in replacement for Node.js
- **Modern**: Active development with new features

**Q: Can I extend Dexter with custom tools?**

A: Yes! See the Developer Guide section for:
- How to add new tools to the registry
- Zod schema validation
- Tool execution patterns

**Q: Does Dexter store my queries?**

A: Query history is stored:
- In memory during the session (in `.dexter/` folder)
- Not sent to any external service except LLM providers
- Never uploaded or shared publicly

You can clear history by deleting the `.dexter/` folder.

**Q: Can I use Dexter commercially?**

A: Yes. Dexter is MIT-licensed, which allows:
- Commercial use
- Modification
- Distribution
- Private use

Always comply with the terms of service of the API providers you use.

**Q: How do I get support?**

A: Support options:
- **GitHub Issues**: For bugs and feature requests
- **README.md**: Basic installation and usage
- **This User Guide**: Comprehensive documentation

---

## Appendix

### Keyboard Shortcut Reference

| Key | Action |
|-----|--------|
| `Enter` | Submit query |
| `Ctrl+C` | Exit / Cancel |
| `Escape` | Cancel current operation |
| `Up` | Previous command |
| `Down` | Next command |
| `/model` | Switch models |

### Environment Variable Quick Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | No* | OpenAI API key |
| `ANTHROPIC_API_KEY` | No* | Anthropic API key |
| `GOOGLE_API_KEY` | No* | Google API key |
| `OLLAMA_BASE_URL` | No | Ollama server URL |
| `FINANCIAL_DATASETS_API_KEY` | Yes | Financial data API key |
| `TAVILY_API_KEY` | No | Web search API key |

*At least one LLM provider key is required.

### Useful Links

- **Dexter Repository**: [https://github.com/virattt/dexter](https://github.com/virattt/dexter)
- **Bun Documentation**: [https://bun.sh/docs](https://bun.sh/docs)
- **Financial Datasets**: [https://financialdatasets.ai](https://financialdatasets.ai)
- **OpenAI API**: [https://platform.openai.com](https://platform.openai.com)
- **Anthropic API**: [https://docs.anthropic.com](https://docs.anthropic.com)
- **Tavily Search**: [https://tavily.com](https://tavily.com)

---

**End of User Manual**

For questions or contributions, visit the [Dexter GitHub Repository](https://github.com/virattt/dexter).
