# Dexter 🤖

Dexter is an autonomous financial research agent that thinks, plans, and learns as it works. It performs analysis using task planning, self-reflection, and real-time market data. Think Claude Code, but built specifically for financial research.


<img width="1098" height="659" alt="Screenshot 2026-01-21 at 5 25 10 PM" src="https://github.com/user-attachments/assets/3bcc3a7f-b68a-4f5e-8735-9d22196ff76e" />


## Overview

Dexter takes complex financial questions and turns them into clear, step-by-step research plans. It runs those tasks using live market data, checks its own work, and refines the results until it has a confident, data-backed answer.  

**Key Capabilities:**
- **Intelligent Task Planning**: Automatically decomposes complex queries into structured research steps
- **Autonomous Execution**: Selects and executes the right tools to gather financial data
- **Self-Validation**: Checks its own work and iterates until tasks are complete
- **Real-Time Financial Data**: Access to income statements, balance sheets, and cash flow statements
- **Safety Features**: Built-in loop detection and step limits to prevent runaway execution

[![Twitter Follow](https://img.shields.io/twitter/follow/virattt?style=social)](https://twitter.com/virattt)

<img width="875" height="558" alt="Screenshot 2026-01-21 at 5 22 19 PM" src="https://github.com/user-attachments/assets/72d28363-69ea-4c74-a297-dfa60aa347f7" />


### Prerequisites

- [Bun](https://bun.com) runtime (v1.0 or higher)
- OpenAI API key (get [here](https://platform.openai.com/api-keys))
- Financial Datasets API key (get [here](https://financialdatasets.ai))
- Exa API key (get [here](https://exa.ai)) - optional, for web search (preferred)
- Tavily API key (get [here](https://tavily.com)) - optional, fallback web search

#### Installing Bun

If you don't have Bun installed, you can install it using curl:

**macOS/Linux:**
```bash
curl -fsSL https://bun.com/install | bash
```

**Windows:**
```bash
powershell -c "irm bun.sh/install.ps1|iex"
```

After installation, restart your terminal and verify Bun is installed:
```bash
bun --version
```

### Installing Dexter

1. Clone the repository:
```bash
git clone https://github.com/virattt/dexter.git
cd dexter
```

2. Install dependencies with Bun:
```bash
bun install
```

3. Set up your environment variables:
```bash
# Copy the example environment file (from parent directory)
cp env.example .env

# Edit .env and add your API keys (if using cloud providers)
# OPENAI_API_KEY=your-openai-api-key
# ANTHROPIC_API_KEY=your-anthropic-api-key
# GOOGLE_API_KEY=your-google-api-key
# XAI_API_KEY=your-xai-api-key

# (Optional) If using Ollama locally
# OLLAMA_BASE_URL=http://127.0.0.1:11434

# Other required keys
# FINANCIAL_DATASETS_API_KEY=your-financial-datasets-api-key

# Web Search (Exa preferred, Tavily fallback)
# EXA_API_KEY=your-exa-api-key
# TAVILY_API_KEY=your-tavily-api-key
```

### Usage

Run Dexter in interactive mode:
```bash
bun start
```

Or with watch mode for development:
```bash
bun dev
```


### Example Queries

Try asking Dexter questions like:
- "What was Apple's revenue growth over the last 4 quarters?"
- "Compare Microsoft and Google's operating margins for 2023"
- "Analyze Tesla's cash flow trends over the past year"
- "What is Amazon's debt-to-equity ratio based on recent financials?"

Dexter will automatically:
1. Break down your question into research tasks
2. Fetch the necessary financial data
3. Perform calculations and analysis
4. Provide a comprehensive, data-rich answer

## Architecture

Dexter uses a multi-agent architecture with specialized components:

- **Planning Agent**: Analyzes queries and creates structured task lists
- **Action Agent**: Selects appropriate tools and executes research steps
- **Validation Agent**: Verifies task completion and data sufficiency
- **Answer Agent**: Synthesizes findings into comprehensive responses

## Tech Stack

- **Runtime**: [Bun](https://bun.sh)
- **UI Framework**: [React](https://react.dev) + [Ink](https://github.com/vadimdemedes/ink) (terminal UI)
- **LLM Integration**: [LangChain.js](https://js.langchain.com) with multi-provider support (OpenAI, Anthropic, Google, xAI, Ollama)
- **Schema Validation**: [Zod](https://zod.dev)
- **Language**: TypeScript


### Changing Models

Type `/model` in the CLI to switch between:
- GPT 4.1 (OpenAI)
- Claude Sonnet 4.5 (Anthropic)
- Gemini 3 (Google)
- Grok 4 (xAI)
- Local models (Ollama)

## MCP (Model Context Protocol) Support

Dexter supports MCP servers, allowing you to extend its capabilities with external tools. MCP is an open protocol that enables AI applications to connect with external data sources and tools.

### Configuring MCP Servers

Create a `.dexter/mcp.json` file in the project root:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/dir"]
    },
    "kite": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mcp.kite.trade/mcp"]
    }
  }
}
```

### Configuration Options

Each server supports the following options:

| Option | Type | Description |
|--------|------|-------------|
| `command` | string | The command to execute (e.g., `npx`, `node`) |
| `args` | string[] | Command line arguments |
| `env` | object | Environment variables (supports `${VAR}` and `${VAR:-default}` syntax) |
| `cwd` | string | Working directory for the server process |
| `enabled` | boolean | Set to `false` to disable the server (default: `true`) |

### Environment Variable Expansion

You can use environment variables in your MCP config:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

### Available MCP Servers

Some popular MCP servers you can use:

| Server | Description | Install |
|--------|-------------|---------|
| [Filesystem](https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem) | Read/write files | `npx -y @modelcontextprotocol/server-filesystem /path` |
| [GitHub](https://github.com/modelcontextprotocol/servers/tree/main/src/github) | GitHub API access | `npx -y @modelcontextprotocol/server-github` |
| [Zerodha Kite](https://mcp.kite.trade) | Indian stock trading | `npx -y mcp-remote https://mcp.kite.trade/mcp` |

### Testing MCP Configuration

Run the MCP test script to verify your configuration:

```bash
bun run scripts/test-mcp.ts
```

This will show:
- Configured servers
- Connection status
- Available tools from each server

### How MCP Tools Appear

MCP tools are prefixed with `mcp_{serverName}_` to avoid conflicts. For example:
- `mcp_filesystem_read_file`
- `mcp_kite_get_holdings`
- `mcp_github_create_issue`

The agent will automatically use these tools when appropriate for your queries.


## How to Contribute

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

**Important**: Please keep your pull requests small and focused.  This will make it easier to review and merge.


## License

This project is licensed under the MIT License.

