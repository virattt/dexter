# Remote Agent Module

This module provides infrastructure for running Dexter as a remote agent in E2B sandboxes.

## Overview

The Remote Agent module enables you to:
- Run Dexter agents in isolated cloud environments (E2B sandboxes)
- Create persistent, always-on financial research agents
- Scale with agent pools for parallel query processing
- Integrate with GitHub for automated code updates
- Pause/resume agents to preserve state

## Module Structure

```
remote_agent/
├── __init__.py              # Package exports
├── config.py                # Configuration management
├── e2b_manager.py          # E2B sandbox lifecycle management
├── github_integration.py   # GitHub API operations
├── orchestrator.py         # Main orchestration layer
├── requirements.txt        # Module dependencies
└── README.md               # This file
```

## Quick Start

### 1. Install Dependencies

```bash
pip install -r remote_agent/requirements.txt
```

### 2. Configure Environment

Copy `env.example.remote` to `.env` and add your API keys:

```bash
cp env.example.remote .env
# Edit .env with your API keys
```

### 3. Use the Orchestrator

```python
from remote_agent.orchestrator import RemoteAgentOrchestrator

# Initialize
orchestrator = RemoteAgentOrchestrator()

# Launch agent
agent_id = orchestrator.launch_agent()

# Query
result = orchestrator.query_agent(agent_id, "Your financial query here")
print(result['answer'])
```

## Core Components

### Configuration (`config.py`)

Manages all configuration through environment variables:

```python
from remote_agent.config import RemoteAgentConfig

config = RemoteAgentConfig.from_env()
config.validate()  # Ensures all required keys are present
```

**Configuration Classes:**
- `E2BConfig`: E2B sandbox settings
- `GitHubConfig`: GitHub API credentials
- `DexterConfig`: Dexter agent parameters
- `ClaudeCodeConfig`: Optional Claude Code integration
- `RemoteAgentConfig`: Complete configuration container

### E2B Manager (`e2b_manager.py`)

Handles E2B sandbox lifecycle:

```python
from remote_agent.e2b_manager import E2BSandboxManager

manager = E2BSandboxManager(api_key="your_key")

# Create sandbox
sandbox_id = manager.create_sandbox(persistent=True)

# Execute commands
sandbox = manager.connect_to_sandbox(sandbox_id)
result = manager.execute_command(sandbox, "ls -la")

# Pause/resume
manager.pause_sandbox(sandbox_id)
manager.resume_sandbox(sandbox_id)
```

**Key Methods:**
- `create_sandbox()`: Create new sandbox with options
- `connect_to_sandbox()`: Connect to existing sandbox
- `pause_sandbox()`: Pause to preserve state
- `resume_sandbox()`: Resume paused sandbox
- `terminate_sandbox()`: Permanently delete sandbox
- `setup_dexter_environment()`: Install and configure Dexter
- `execute_command()`: Run commands in sandbox

### GitHub Integration (`github_integration.py`)

Manages GitHub operations:

```python
from remote_agent.github_integration import GitHubIntegration

github = GitHubIntegration(token, owner, repo)

# Clone repository to sandbox
github.clone_repository(sandbox)

# Create pull request
pr = github.create_pull_request(
    title="Research Results",
    body="Automated research findings",
    head_branch="research-branch"
)

# Set up webhooks
webhook = github.create_webhook(
    webhook_url="https://your-server.com/webhook",
    events=["push", "pull_request"]
)
```

**Key Methods:**
- `clone_repository()`: Clone repo into sandbox
- `pull_latest_changes()`: Update sandbox code
- `create_webhook()`: Set up event notifications
- `create_pull_request()`: Create PRs from sandbox
- `create_branch()`: Create new branch in sandbox
- `commit_and_push()`: Commit and push changes

### Orchestrator (`orchestrator.py`)

Main coordination layer:

```python
from remote_agent.orchestrator import RemoteAgentOrchestrator

orchestrator = RemoteAgentOrchestrator()

# Launch agents
agent_id = orchestrator.launch_agent(
    agent_name="my_research_agent",
    persistent=True,
    timeout=3600
)

# Query agents
result = orchestrator.query_agent(
    agent_id,
    "What was Tesla's revenue last quarter?"
)

# Manage lifecycle
orchestrator.pause_agent(agent_id)
orchestrator.resume_agent(agent_id)
orchestrator.terminate_agent(agent_id)

# Agent pools
pool = orchestrator.create_agent_pool(size=5)

# State management
orchestrator.save_state("state.json")
orchestrator.load_state("state.json")
```

**Key Methods:**
- `launch_agent()`: Create and initialize new agent
- `query_agent()`: Send research queries
- `pause_agent()`: Pause agent
- `resume_agent()`: Resume paused agent
- `terminate_agent()`: Terminate agent
- `update_agent_code()`: Pull latest code updates
- `health_check()`: Check agent responsiveness
- `create_agent_pool()`: Create multiple agents
- `save_state()` / `load_state()`: Persist orchestrator state

## Usage Patterns

### Pattern 1: Single Persistent Agent

Best for personal research or low query volume:

```python
orchestrator = RemoteAgentOrchestrator()

# Launch once
agent_id = orchestrator.launch_agent(persistent=True, timeout=86400)

# Use multiple times
for query in queries:
    result = orchestrator.query_agent(agent_id, query)
    # Process result...

# Pause when done
orchestrator.pause_agent(agent_id)
```

### Pattern 2: Agent Pool

Best for parallel processing:

```python
from concurrent.futures import ThreadPoolExecutor

orchestrator = RemoteAgentOrchestrator()

# Create pool
pool = orchestrator.create_agent_pool(size=5)

# Process in parallel
with ThreadPoolExecutor(max_workers=5) as executor:
    futures = [
        executor.submit(orchestrator.query_agent, agent_id, query)
        for agent_id, query in zip(pool, queries)
    ]
    results = [f.result() for f in futures]

# Cleanup
for agent_id in pool:
    orchestrator.terminate_agent(agent_id)
```

### Pattern 3: Ephemeral Agents

Best for one-off queries:

```python
def research_and_cleanup(query):
    orchestrator = RemoteAgentOrchestrator()
    agent_id = orchestrator.launch_agent(persistent=False)

    try:
        result = orchestrator.query_agent(agent_id, query)
        return result
    finally:
        orchestrator.terminate_agent(agent_id)
```

## State Management

The orchestrator can persist its state across sessions:

```python
# Session 1: Create and save
orchestrator = RemoteAgentOrchestrator()
agent_id = orchestrator.launch_agent()
orchestrator.save_state("my_state.json")

# Session 2: Load and resume
orchestrator = RemoteAgentOrchestrator()
orchestrator.load_state("my_state.json")
# All agents are restored
```

State includes:
- All tracked agents
- Agent metadata
- Query counts
- Timestamps

## Error Handling

The module includes comprehensive error handling:

```python
try:
    result = orchestrator.query_agent(agent_id, query, timeout=60)

    if result["success"]:
        print(result["answer"])
    else:
        print(f"Query failed: {result['error']}")

except ValueError as e:
    print(f"Invalid agent: {e}")
except Exception as e:
    print(f"Unexpected error: {e}")
```

## Logging

The module uses Python's `logging` module:

```python
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Use orchestrator
orchestrator = RemoteAgentOrchestrator()
# All operations are logged
```

Log levels:
- `DEBUG`: Detailed operation info
- `INFO`: Major operations (default)
- `WARNING`: Recoverable issues
- `ERROR`: Operation failures

## Testing

### Unit Tests

```bash
pytest tests/test_remote_agent.py
```

### Integration Tests

```bash
# Requires valid API keys in .env
pytest tests/test_remote_agent_integration.py
```

### Manual Testing

Use the provided examples:

```bash
python examples/simple_remote_agent.py
python examples/agent_pool_example.py
python examples/persistent_agent_example.py
```

## Troubleshooting

### Common Issues

**Import Error: "No module named 'e2b_code_interpreter'"**
```bash
pip install e2b-code-interpreter
```

**ValueError: "Configuration validation failed"**
- Check that all required API keys are in `.env`
- Verify `.env` is in the project root
- Ensure no typos in variable names

**E2B Connection Failed**
- Verify E2B API key is valid
- Check E2B dashboard for service status
- Ensure you haven't exceeded quota

**Git Clone Failed**
- Check GitHub token has `repo` scope
- Verify repository owner and name are correct
- Ensure repository is accessible

### Debug Mode

Enable verbose logging:

```python
import logging
logging.basicConfig(level=logging.DEBUG)

orchestrator = RemoteAgentOrchestrator()
# All operations logged in detail
```

## Performance Considerations

### E2B Costs

- **Active time**: Billed per second
- **Paused time**: Free
- **Max paused duration**: 30 days

**Optimization tips:**
- Use `auto_pause=True` for persistent agents
- Terminate agents when done
- Use agent pools wisely
- Monitor usage in E2B dashboard

### API Costs

- **OpenAI**: Varies by model and tokens
- **Financial Datasets**: Check their pricing
- **GitHub API**: Free (5000 requests/hour)

**Optimization tips:**
- Cache results when possible
- Batch similar queries
- Use appropriate model sizes

## Security

### Best Practices

1. **API Keys**:
   - Never commit to version control
   - Use environment variables
   - Rotate regularly

2. **GitHub Tokens**:
   - Minimal required scopes only
   - Consider GitHub Apps for production
   - Monitor usage in GitHub settings

3. **E2B Sandboxes**:
   - Isolated by default
   - No shared state between sandboxes
   - Automatic cleanup on termination

4. **Code Execution**:
   - Only run trusted code
   - Validate user input
   - Monitor sandbox activity

## Advanced Topics

### Custom Tools

Add your own financial tools:

```python
# In src/dexter/tools/custom.py
def custom_analysis(ticker: str) -> dict:
    # Your analysis logic
    return {"analysis": "..."}

# Register in src/dexter/tools/__init__.py
TOOLS.append(custom_analysis)
```

### Custom Orchestrator

Extend the orchestrator:

```python
from remote_agent.orchestrator import RemoteAgentOrchestrator

class CustomOrchestrator(RemoteAgentOrchestrator):
    def custom_workflow(self, query):
        agent_id = self.launch_agent()
        # Custom logic
        result = self.query_agent(agent_id, query)
        self.terminate_agent(agent_id)
        return result
```

### Webhook Handlers

Process GitHub webhooks:

```python
from flask import Flask, request

app = Flask(__name__)

@app.route('/webhook', methods=['POST'])
def handle_webhook():
    event = request.headers.get('X-GitHub-Event')
    payload = request.json

    if event == 'push':
        # Update all agents
        for agent_id in orchestrator.list_agents():
            orchestrator.update_agent_code(agent_id)

    return 'OK'
```

## Contributing

Contributions welcome! Please:
1. Add tests for new features
2. Update documentation
3. Follow existing code style
4. Create focused pull requests

## License

Same as parent project (MIT License)

## Support

- **Documentation**: See parent README and architecture docs
- **Issues**: Create a GitHub issue
- **E2B Support**: https://e2b.dev/docs
- **Dexter Project**: https://github.com/virattt/dexter
