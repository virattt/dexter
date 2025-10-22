# Remote Agent Architecture: Running Dexter in E2B

This document provides a comprehensive guide to deploying Dexter as a persistent remote agent running in E2B (E2B.dev) sandboxes, with full integration of GitHub API, Claude Code CLI, and other necessary APIs.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Components](#components)
3. [E2B Integration](#e2b-integration)
4. [GitHub API Integration](#github-api-integration)
5. [Claude Code CLI Integration](#claude-code-cli-integration)
6. [Setup Guide](#setup-guide)
7. [API Reference](#api-reference)
8. [Deployment Patterns](#deployment-patterns)
9. [Security Considerations](#security-considerations)

---

## Architecture Overview

### High-Level Design

```
┌─────────────────────────────────────────────────────────────────┐
│                      Control Plane (Local/Server)                │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  GitHub API  │  │   E2B API    │  │ Orchestrator │          │
│  │  Integration │  │   Manager    │  │    Layer     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    E2B Sandbox (Remote Agent)                    │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Dexter Agent Runtime                    │  │
│  │                                                             │  │
│  │  • Python Environment (3.10+)                              │  │
│  │  • Dexter Agent (agent.py)                                 │  │
│  │  • Financial Tools (APIs)                                  │  │
│  │  • Claude Code CLI (optional)                              │  │
│  │  • API Clients (OpenAI, Financial Datasets)                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Persistent Storage                      │  │
│  │  • Agent State                                             │  │
│  │  • Research Results                                        │  │
│  │  • Task History                                            │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Benefits

1. **Always-On Agent**: Runs 24/7 in a cloud sandbox
2. **Persistent State**: Can pause/resume with full memory and filesystem preservation
3. **Secure Isolation**: Runs in isolated E2B sandbox environment
4. **API-Driven**: Fully controllable via APIs (E2B, GitHub, Claude)
5. **Scalable**: Can spawn multiple agents for parallel research

---

## Components

### 1. E2B Sandbox Manager

Handles lifecycle management of E2B sandboxes:
- Creating sandboxes with custom configurations
- Setting up persistent environments
- Managing pause/resume for long-lived agents
- Monitoring sandbox health and metrics

### 2. GitHub Integration Layer

Manages repository operations:
- Cloning Dexter repository into sandbox
- Webhook handling for updates
- Pull request automation
- Issue tracking integration

### 3. Orchestration Layer

Coordinates between components:
- Request routing
- State management
- Error handling and recovery
- Logging and monitoring

### 4. Agent Runtime

The Dexter agent running inside E2B:
- Financial research execution
- API interactions
- Result persistence
- Status reporting

---

## E2B Integration

### Sandbox Configuration

E2B sandboxes for Dexter agents should be configured with:

```python
from e2b_code_interpreter import Sandbox

# Create a long-lived sandbox for persistent agent
sandbox = Sandbox.create(
    timeout=86400,  # 24 hours (max for Pro users)
    metadata={
        "agent_type": "dexter_financial_research",
        "version": "0.1.0",
        "created_by": "orchestrator"
    }
)
```

### Persistence Strategy

For truly always-on agents, use the pause/resume feature:

```python
# Enable auto-pause to preserve state
sandbox = Sandbox.beta_create(
    auto_pause=True,  # Auto-pause instead of killing
    timeout=3600,     # 1 hour active time
)

# Manually pause when needed
sandbox.beta_pause()

# Resume from same state
resumed_sandbox = Sandbox.connect(sandbox.id)
```

**Important**: Paused sandboxes persist for 30 days before cleanup.

### Sandbox Limits

| Tier  | Max Timeout | Max Paused Duration |
|-------|-------------|---------------------|
| Hobby | 1 hour      | 30 days            |
| Pro   | 24 hours    | 30 days            |

---

## GitHub API Integration

### Repository Setup

The orchestrator clones and maintains the Dexter repository in the sandbox:

```python
import requests

def clone_repo_to_sandbox(sandbox, repo_url, github_token):
    """Clone GitHub repository into E2B sandbox"""

    # Use GitHub token for private repos
    auth_url = repo_url.replace(
        "https://",
        f"https://{github_token}@"
    )

    # Execute git clone in sandbox
    result = sandbox.process.start_and_wait(
        f"git clone {auth_url} /home/user/dexter"
    )

    return result
```

### Webhook Integration

Set up webhooks to update the agent when code changes:

```python
def setup_github_webhook(repo_owner, repo_name, github_token, webhook_url):
    """Create GitHub webhook for repository updates"""

    url = f"https://api.github.com/repos/{repo_owner}/{repo_name}/hooks"

    payload = {
        "config": {
            "url": webhook_url,
            "content_type": "json"
        },
        "events": ["push", "pull_request"],
        "active": True
    }

    headers = {
        "Authorization": f"token {github_token}",
        "Accept": "application/vnd.github.v3+json"
    }

    response = requests.post(url, json=payload, headers=headers)
    return response.json()
```

### Automated Pull Requests

Create PRs from agent research results:

```python
def create_pull_request(repo_owner, repo_name, github_token,
                       title, body, head_branch, base_branch="main"):
    """Create a pull request with agent results"""

    url = f"https://api.github.com/repos/{repo_owner}/{repo_name}/pulls"

    payload = {
        "title": title,
        "body": body,
        "head": head_branch,
        "base": base_branch
    }

    headers = {
        "Authorization": f"token {github_token}",
        "Accept": "application/vnd.github.v3+json"
    }

    response = requests.post(url, json=payload, headers=headers)
    return response.json()
```

---

## Claude Code CLI Integration

### Installation in Sandbox

```python
def install_claude_code_cli(sandbox):
    """Install Claude Code CLI in E2B sandbox"""

    # Install npm (if not present)
    sandbox.process.start_and_wait("apt-get update && apt-get install -y npm")

    # Install Claude Code CLI
    sandbox.process.start_and_wait("npm install -g @anthropic-ai/claude-code")

    return True
```

### Configuration

```python
def configure_claude_code(sandbox, anthropic_api_key):
    """Configure Claude Code CLI with API key"""

    # Set up config directory
    sandbox.process.start_and_wait("mkdir -p ~/.config/claude-code")

    # Write config
    config = f'''{{
  "anthropicApiKey": "{anthropic_api_key}",
  "modelId": "claude-sonnet-4-5-20250929"
}}'''

    sandbox.filesystem.write("~/.config/claude-code/config.json", config)

    return True
```

### Using Claude Code as Agent Enhancement

The Claude Code CLI can augment Dexter's capabilities:

```python
def run_claude_code_analysis(sandbox, query):
    """Use Claude Code CLI for enhanced analysis"""

    command = f'echo "{query}" | claude-code --non-interactive'
    result = sandbox.process.start_and_wait(command)

    return result.stdout
```

---

## Setup Guide

### Prerequisites

You'll need the following API keys:
- **E2B API Key**: Get from [e2b.dev](https://e2b.dev)
- **GitHub Personal Access Token**: From GitHub Settings → Developer settings
- **OpenAI API Key**: From [platform.openai.com](https://platform.openai.com)
- **Financial Datasets API Key**: From [financialdatasets.ai](https://financialdatasets.ai)
- **Anthropic API Key**: (Optional) For Claude Code CLI

### Step 1: Install Dependencies

```bash
pip install e2b requests python-dotenv PyGithub
```

### Step 2: Set Up Environment Variables

Create a `.env` file:

```bash
# E2B Configuration
E2B_API_KEY=your_e2b_api_key

# GitHub Configuration
GITHUB_TOKEN=your_github_token
GITHUB_REPO_OWNER=your_username
GITHUB_REPO_NAME=dexter

# Dexter Agent Keys (will be passed to sandbox)
OPENAI_API_KEY=your_openai_key
FINANCIAL_DATASETS_API_KEY=your_financial_datasets_key

# Optional: Claude Code
ANTHROPIC_API_KEY=your_anthropic_key
```

### Step 3: Deploy the Orchestrator

Use the provided orchestrator scripts (see `/remote_agent/` directory)

### Step 4: Launch Remote Agent

```python
from remote_agent.orchestrator import RemoteAgentOrchestrator

# Initialize orchestrator
orchestrator = RemoteAgentOrchestrator()

# Launch agent in E2B
agent_id = orchestrator.launch_agent(
    repo_url="https://github.com/yourusername/dexter",
    persistent=True
)

# Query the remote agent
result = orchestrator.query_agent(
    agent_id=agent_id,
    query="What was Apple's revenue growth over the last 4 quarters?"
)

print(result)
```

---

## API Reference

### Orchestrator API

#### `launch_agent(repo_url, persistent=True)`

Creates and initializes a new remote agent.

**Parameters:**
- `repo_url` (str): GitHub repository URL
- `persistent` (bool): Enable pause/resume for long-lived agents

**Returns:**
- `agent_id` (str): Unique identifier for the agent

#### `query_agent(agent_id, query)`

Send a research query to the remote agent.

**Parameters:**
- `agent_id` (str): Agent identifier
- `query` (str): Research question

**Returns:**
- `result` (dict): Research results with metadata

#### `pause_agent(agent_id)`

Pause an agent, preserving its state.

**Parameters:**
- `agent_id` (str): Agent identifier

#### `resume_agent(agent_id)`

Resume a paused agent.

**Parameters:**
- `agent_id` (str): Agent identifier

#### `terminate_agent(agent_id)`

Permanently terminate an agent.

**Parameters:**
- `agent_id` (str): Agent identifier

---

## Deployment Patterns

### Pattern 1: Single Persistent Agent

One always-on agent handling all queries sequentially.

**Best for:**
- Personal research
- Low query volume
- Cost optimization

```python
# Launch once
agent = orchestrator.launch_agent(repo_url, persistent=True)

# Query multiple times
results = []
for query in queries:
    result = orchestrator.query_agent(agent, query)
    results.append(result)
```

### Pattern 2: Agent Pool

Multiple agents handling queries in parallel.

**Best for:**
- High query volume
- Parallel research tasks
- Production environments

```python
# Create agent pool
agent_pool = orchestrator.create_agent_pool(size=5)

# Distribute queries
with ThreadPoolExecutor(max_workers=5) as executor:
    futures = [
        executor.submit(orchestrator.query_agent, agent_id, query)
        for agent_id, query in zip(agent_pool, queries)
    ]
    results = [f.result() for f in futures]
```

### Pattern 3: On-Demand Agents

Spawn agents for each query, terminate after completion.

**Best for:**
- Sporadic usage
- Isolation requirements
- Testing

```python
def research_with_ephemeral_agent(query):
    # Create agent
    agent_id = orchestrator.launch_agent(repo_url, persistent=False)

    try:
        # Run query
        result = orchestrator.query_agent(agent_id, query)
        return result
    finally:
        # Clean up
        orchestrator.terminate_agent(agent_id)
```

---

## Security Considerations

### API Key Management

1. **Never commit API keys** to the repository
2. **Use environment variables** for all secrets
3. **Rotate keys regularly**, especially if exposed
4. **Use separate keys** for production and development

### E2B Sandbox Security

1. **Sandboxes are isolated** from each other
2. **Network access** can be restricted
3. **Monitor sandbox activity** through E2B dashboard
4. **Set appropriate timeouts** to prevent runaway costs

### GitHub Access

1. **Use Personal Access Tokens** with minimal scopes
2. **Required scopes**: `repo`, `workflow` (if using Actions)
3. **Consider GitHub Apps** for production deployments

### Financial Data APIs

1. **Protect API keys** - they're tied to billing
2. **Implement rate limiting** on the orchestrator
3. **Monitor API usage** to detect anomalies

---

## Cost Optimization

### E2B Costs

- **Hobby Plan**: $20/month - 1 hour max timeout
- **Pro Plan**: $100/month - 24 hour max timeout
- **Enterprise**: Custom pricing

**Tips:**
- Use `auto_pause` to minimize active time
- Terminate agents when not in use
- Use shorter timeouts for development

### API Costs

- **OpenAI**: Varies by model (GPT-4 is more expensive)
- **Financial Datasets**: Check their pricing tiers

**Tips:**
- Cache research results
- Batch similar queries
- Use smaller models where possible

---

## Monitoring and Logging

### E2B Metrics

Track sandbox metrics:
- Active time vs. paused time
- Number of restarts
- Memory and CPU usage

### Application Logging

Implement comprehensive logging:

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('remote_agent.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger('RemoteAgent')
```

### Health Checks

Implement periodic health checks:

```python
def health_check(agent_id):
    """Check if agent is responsive"""
    try:
        result = orchestrator.query_agent(
            agent_id,
            "ping",  # Simple test query
            timeout=10
        )
        return result is not None
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return False
```

---

## Troubleshooting

### Common Issues

#### Sandbox Timeout

**Problem**: Sandbox terminates before completing long-running tasks.

**Solution**: Increase timeout or enable auto-pause:
```python
sandbox = Sandbox.create(timeout=86400)  # 24 hours
```

#### Connection Lost

**Problem**: Can't reconnect to paused sandbox.

**Solution**: Store sandbox IDs persistently and use `Sandbox.connect()`:
```python
sandbox = Sandbox.connect(stored_sandbox_id)
```

#### Git Clone Fails

**Problem**: Repository clone fails in sandbox.

**Solution**: Check GitHub token permissions and use authenticated URL:
```python
auth_url = f"https://{token}@github.com/user/repo.git"
```

#### Out of Memory

**Problem**: Agent crashes due to memory limits.

**Solution**: Optimize data processing or use larger E2B instance:
```python
# Contact E2B support for larger instances
```

---

## Next Steps

1. Review the implementation scripts in `/remote_agent/`
2. Set up your API keys in `.env`
3. Run the example orchestrator
4. Customize for your use case
5. Deploy to production

## References

- [E2B Documentation](https://e2b.dev/docs)
- [GitHub API Documentation](https://docs.github.com/en/rest)
- [Claude Code CLI](https://docs.claude.com/claude-code)
- [Dexter GitHub Repository](https://github.com/virattt/dexter)

---

**Last Updated**: October 2025
**Version**: 1.0.0
