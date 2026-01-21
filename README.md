# Ubbex 🤖

Ubbex is an agentic coding assistant that lives in your terminal. Built in the style of Claude Code, it thinks in steps, streams tool calls, and supports Triton natively. It pairs a TypeScript + Bun CLI with extensible MCP (Model Context Protocol) integration for powerful development workflows.


<img width="979" height="651" alt="Screenshot 2025-10-14 at 6 12 35 PM" src="https://github.com/user-attachments/assets/5a2859d4-53cf-4638-998a-15cef3c98038" />

## Overview

Ubbex is an intelligent coding assistant that understands your entire codebase, helps you write and debug code, and automates routine development tasks—all through natural language commands in your terminal.

**Key Capabilities:**
- **Codebase Understanding**: Analyzes and understands entire codebases through contextual exploration
- **Code Writing & Debugging**: Writes, refactors, and debugs code across multiple languages and frameworks
- **Git Workflow Automation**: Handles commits, branching, merging, and other git operations via natural language
- **Task Automation**: Automates routine tasks like running tests, fixing lints, and formatting code
- **Code Explanation**: Explains complex code in clear, understandable terms
- **Tool Integration**: Integrates with external tools (Jira, Figma, Slack, etc.) via MCP servers
- **Custom Skills**: Extensible through MCP protocol for custom development workflows
- **Multi-Model Support**: Works with OpenAI, Anthropic, Google, xAI, Triton, and Ollama models
- **Safety Features**: Built-in loop detection and step limits to prevent runaway execution

[![Twitter Follow](https://img.shields.io/twitter/follow/virattt?style=social)](https://twitter.com/virattt)

<img width="996" height="639" alt="Screenshot 2025-11-22 at 1 45 07 PM" src="https://github.com/user-attachments/assets/8915fd70-82c9-4775-bdf9-78d5baf28a8a" />


### Prerequisites

- [Bun](https://bun.com) runtime (v1.0 or higher)
- OpenAI API key (get [here](https://platform.openai.com/api-keys)) - optional, for OpenAI models
- Anthropic API key (get [here](https://console.anthropic.com)) - optional, for Claude models
- Google API key - optional, for Gemini models
- xAI API key (get [here](https://console.x.ai)) - optional, for Grok models
- Triton API key + base URL - optional, for Triton inference
- Tavily API key (get [here](https://tavily.com)) - optional, for web search
- Python 3.10+ (optional, for MCP Python tools and custom integrations)

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

### Installing Ubbex

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

# (Optional) Triton inference server (no API key required)
# TRITON_BASE_URL=http://127.0.0.1:8000

# (Optional) MCP servers (JSON array)
# MCP_SERVERS=[{"name":"python","command":"python","args":["python/mcp_server.py"]}]

# (Optional) Web search
# TAVILY_API_KEY=your-tavily-api-key
```

### Usage

Run Ubbex in interactive mode:
```bash
bun start
```

Or with watch mode for development:
```bash
bun dev
```

### Example Commands

Try asking Ubbex to help you with:

**Code Understanding:**
- "Explain how the authentication system works in this codebase"
- "What does the UserService class do?"
- "Show me all the API endpoints in this project"

**Code Writing & Refactoring:**
- "Add a new endpoint for user profile updates"
- "Refactor the database connection logic to use a connection pool"
- "Write unit tests for the PaymentProcessor class"

**Debugging:**
- "Why is this function returning undefined?"
- "Find and fix the memory leak in the event handlers"
- "Debug the failing test in user.test.ts"

**Git & Workflow Automation:**
- "Commit my changes with a descriptive message"
- "Create a new feature branch for user authentication"
- "Show me what changed in the last 3 commits"

**Task Automation:**
- "Run the linter and fix all auto-fixable issues"
- "Run the test suite and show me what failed"
- "Format all TypeScript files in the src directory"

Ubbex will automatically:
1. Understand the context of your codebase
2. Break down complex tasks into steps
3. Execute the necessary operations
4. Provide clear explanations and results

## Architecture

Ubbex uses an agentic architecture with intelligent task planning and execution:

- **Task Planning**: Automatically decomposes complex coding tasks into structured steps
- **Tool Selection**: Intelligently selects and executes the right tools for each task
- **Context Management**: Maintains understanding of your codebase throughout interactions
- **Iterative Execution**: Validates work and refines results until tasks are complete
- **MCP Integration**: Extensible tool system via Model Context Protocol for custom workflows

## Tech Stack

- **Runtime**: [Bun](https://bun.sh)
- **UI Framework**: [React](https://react.dev) + [Ink](https://github.com/vadimdemedes/ink) (terminal UI)
- **LLM Integration**: [LangChain.js](https://js.langchain.com) with multi-provider support (OpenAI, Anthropic, Google, xAI, Triton, Ollama)
- **Protocols**: MCP for local tool extensions, plus a bundled Python MCP server
- **Schema Validation**: [Zod](https://zod.dev)
- **Language**: TypeScript


### Changing Models

Type `/model` in the CLI to switch between:
- GPT 4.1 (OpenAI)
- Claude Sonnet 4.5 (Anthropic)
- Gemini 3 (Google)
- Grok 4 (xAI)
- Local models (Ollama)

## How to Contribute

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

**Important**: Please keep your pull requests small and focused.  This will make it easier to review and merge.


## License

This project is licensed under the MIT License.
