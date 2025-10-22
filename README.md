# Dexter 🤖

Dexter is an autonomous financial research agent that thinks, plans, and learns as it works. It performs analysis using task planning, self-reflection, and real-time market data. Think Claude Code, but built specifically for financial research.


<img width="979" height="651" alt="Screenshot 2025-10-14 at 6 12 35 PM" src="https://github.com/user-attachments/assets/5a2859d4-53cf-4638-998a-15cef3c98038" />

## Overview

Dexter takes complex financial questions and turns them into clear, step-by-step research plans. It runs those tasks using live market data, checks its own work, and refines the results until it has a confident, data-backed answer.  

It’s not just another chatbot.  It’s an agent that plans ahead, verifies its progress, and keeps iterating until the job is done.

**Key Capabilities:**
- **Intelligent Task Planning**: Automatically decomposes complex queries into structured research steps
- **Autonomous Execution**: Selects and executes the right tools to gather financial data
- **Self-Validation**: Checks its own work and iterates until tasks are complete
- **Real-Time Financial Data**: Access to income statements, balance sheets, and cash flow statements
- **Safety Features**: Built-in loop detection and step limits to prevent runaway execution

[![Twitter Follow](https://img.shields.io/twitter/follow/virattt?style=social)](https://twitter.com/virattt)

### Prerequisites

- Python 3.10 or higher
- [uv](https://github.com/astral-sh/uv) package manager
- OpenAI API key (get [here](https://platform.openai.com/api-keys))
- Financial Datasets API key (get [here](https://financialdatasets.ai))

### Installation

1. Clone the repository:
```bash
git clone https://github.com/virattt/dexter.git
cd dexter
```

2. Install dependencies with uv:
```bash
uv sync
```

3. Set up your environment variables:
```bash
# Copy the example environment file
cp env.example .env

# Edit .env and add your API keys
# OPENAI_API_KEY=your-openai-api-key
# FINANCIAL_DATASETS_API_KEY=your-financial-datasets-api-key
```

### Usage

Run Dexter in interactive mode:
```bash
uv run dexter-agent
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

## Project Structure

```
dexter/
├── src/
│   ├── dexter/
│   │   ├── agent.py      # Main agent orchestration logic
│   │   ├── model.py      # LLM interface
│   │   ├── tools.py      # Financial data tools
│   │   ├── prompts.py    # System prompts for each component
│   │   ├── schemas.py    # Pydantic models
│   │   ├── utils/        # Utility functions
│   │   └── cli.py        # CLI entry point
├── pyproject.toml
└── uv.lock
```

## Configuration

Dexter supports configuration via the `Agent` class initialization:

```python
from dexter.agent import Agent

agent = Agent(
    max_steps=20,              # Global safety limit
    max_steps_per_task=5       # Per-task iteration limit
)
```

## Remote Agent Deployment

Run Dexter as a remote agent in E2B cloud sandboxes for always-on, scalable financial research.

### Features

- **Always-On Agents**: Run 24/7 in isolated cloud sandboxes
- **Persistent State**: Pause/resume with full memory preservation
- **Scalable**: Single agent to agent pools for parallel processing
- **Complete API Integration**: E2B, GitHub, OpenAI, Financial Datasets
- **Production Ready**: Comprehensive error handling, logging, and monitoring

### Quick Start

1. **Install dependencies:**
   ```bash
   ./setup_remote_agent.sh
   ```

2. **Configure API keys:**
   ```bash
   cp env.example.remote .env
   # Edit .env with your E2B, GitHub, OpenAI, and Financial Datasets API keys
   ```

3. **Run a remote agent:**
   ```python
   from remote_agent.orchestrator import RemoteAgentOrchestrator

   # Initialize and launch
   orchestrator = RemoteAgentOrchestrator()
   agent_id = orchestrator.launch_agent(persistent=True)

   # Query the agent
   result = orchestrator.query_agent(
       agent_id,
       "What was Apple's revenue growth over the last 4 quarters?"
   )
   print(result['answer'])
   ```

### Documentation

- **Quick Start Guide**: See [`REMOTE_AGENT_QUICKSTART.md`](REMOTE_AGENT_QUICKSTART.md) for detailed setup instructions
- **Architecture**: See [`REMOTE_AGENT_ARCHITECTURE.md`](REMOTE_AGENT_ARCHITECTURE.md) for system design and patterns
- **Module Docs**: See [`remote_agent/README.md`](remote_agent/README.md) for API reference
- **Summary**: See [`REMOTE_AGENT_SUMMARY.md`](REMOTE_AGENT_SUMMARY.md) for complete overview

### Examples

Run the provided examples:

```bash
# Simple single agent
python examples/simple_remote_agent.py

# Parallel processing with agent pool
python examples/agent_pool_example.py

# Persistent agent with pause/resume
python examples/persistent_agent_example.py
```

## How to Contribute

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

**Important**: Please keep your pull requests small and focused.  This will make it easier to review and merge.


## License

This project is licensed under the MIT License.

