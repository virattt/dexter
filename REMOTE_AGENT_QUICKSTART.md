# Remote Agent Quick Start Guide

This guide will help you get started with running Dexter as a remote agent in E2B sandboxes in under 10 minutes.

## Prerequisites

Before you begin, make sure you have:

1. Python 3.10 or higher
2. API keys for:
   - E2B (get at https://e2b.dev)
   - GitHub Personal Access Token
   - OpenAI
   - Financial Datasets

## Step 1: Install Dependencies

```bash
# Install remote agent dependencies
pip install -r remote_agent/requirements.txt

# Install Dexter dependencies (if not already done)
uv sync
```

## Step 2: Configure Environment

Create a `.env` file in the project root with your API keys:

```bash
# E2B Configuration
E2B_API_KEY=your_e2b_api_key_here
E2B_DEFAULT_TIMEOUT=3600
E2B_AUTO_PAUSE=true
E2B_MAX_TIMEOUT=86400

# GitHub Configuration
GITHUB_TOKEN=your_github_token_here
GITHUB_REPO_OWNER=your_github_username
GITHUB_REPO_NAME=dexter

# Dexter Agent Configuration
OPENAI_API_KEY=your_openai_api_key_here
FINANCIAL_DATASETS_API_KEY=your_financial_datasets_key_here
DEXTER_MAX_STEPS=20
DEXTER_MAX_STEPS_PER_TASK=5

# Optional: Claude Code (if you want enhanced capabilities)
# ANTHROPIC_API_KEY=your_anthropic_key_here
# ENABLE_CLAUDE_CODE=true
```

## Step 3: Run Your First Remote Agent

### Option A: Simple Example

Run a single agent with one query:

```bash
python examples/simple_remote_agent.py
```

This will:
1. Launch a remote agent in E2B
2. Send a sample query
3. Display the results
4. Let you choose to pause, terminate, or keep running

### Option B: Agent Pool Example

Run multiple agents in parallel:

```bash
python examples/agent_pool_example.py
```

This will:
1. Create a pool of 5 agents
2. Process 5 queries in parallel
3. Display all results
4. Clean up automatically

### Option C: Persistent Agent Example

Test pause/resume functionality:

```bash
python examples/persistent_agent_example.py
```

This will:
1. Create a persistent agent
2. Run a query
3. Pause the agent
4. Resume and run another query
5. Show how state is preserved

## Step 4: Use in Your Own Code

Here's a minimal example to integrate into your own projects:

```python
from remote_agent.orchestrator import RemoteAgentOrchestrator

# Initialize
orchestrator = RemoteAgentOrchestrator()

# Launch agent
agent_id = orchestrator.launch_agent(persistent=True)

# Query
result = orchestrator.query_agent(
    agent_id,
    "What was Apple's revenue growth over the last 4 quarters?"
)

print(result['answer'])

# Pause when done (preserves state)
orchestrator.pause_agent(agent_id)
```

## Common Use Cases

### Use Case 1: Always-On Research Agent

Create a long-lived agent that's always available:

```python
# Launch with 24-hour timeout (Pro tier)
agent_id = orchestrator.launch_agent(
    agent_name="always_on_research",
    persistent=True,
    timeout=86400  # 24 hours
)

# Save the agent ID for later use
with open('agent_id.txt', 'w') as f:
    f.write(agent_id)
```

### Use Case 2: Batch Processing

Process multiple queries sequentially:

```python
agent_id = orchestrator.launch_agent()

queries = [
    "What is Tesla's PE ratio?",
    "Compare Microsoft and Google's profit margins",
    "What was Amazon's revenue last quarter?"
]

results = []
for query in queries:
    result = orchestrator.query_agent(agent_id, query)
    results.append(result)

# Process results...
```

### Use Case 3: Scheduled Research

Use with cron or task scheduler:

```python
# scheduled_research.py
import schedule
import time

def daily_research():
    orchestrator = RemoteAgentOrchestrator()
    agent_id = orchestrator.launch_agent()

    # Run daily analysis
    result = orchestrator.query_agent(
        agent_id,
        "What are the top gainers in the S&P 500 today?"
    )

    # Save or email results
    with open(f'daily_report_{date.today()}.txt', 'w') as f:
        f.write(result['answer'])

    orchestrator.terminate_agent(agent_id)

# Schedule daily at 9 AM
schedule.every().day.at("09:00").do(daily_research)

while True:
    schedule.run_pending()
    time.sleep(60)
```

## API Key Setup Guide

### E2B API Key

1. Go to https://e2b.dev
2. Sign up or log in
3. Navigate to Dashboard → API Keys
4. Create a new API key
5. Copy and add to `.env`

**Pricing**:
- Hobby: $20/month (1 hour max timeout)
- Pro: $100/month (24 hour max timeout)

### GitHub Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Generate new token (classic)
3. Select scopes:
   - `repo` (full control of private repositories)
   - `workflow` (if using GitHub Actions)
4. Copy token and add to `.env`

**Note**: Keep this token secret! It has access to your repositories.

### OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Create new secret key
3. Copy and add to `.env`

**Cost**: Varies by model (GPT-4 is ~$0.03-0.06 per query)

### Financial Datasets API Key

1. Go to https://financialdatasets.ai
2. Sign up for an account
3. Get your API key from dashboard
4. Copy and add to `.env`

## Troubleshooting

### Issue: "E2B_API_KEY not found"

**Solution**: Make sure your `.env` file is in the project root and properly formatted.

### Issue: "Failed to clone repository"

**Solution**:
1. Check that `GITHUB_TOKEN` has correct permissions
2. Verify `GITHUB_REPO_OWNER` and `GITHUB_REPO_NAME` are correct
3. Make sure the repository exists and is accessible

### Issue: "Sandbox timeout"

**Solution**:
1. Increase timeout: `orchestrator.launch_agent(timeout=7200)`
2. Enable auto-pause: Already enabled by default
3. For Pro tier, use up to 24 hours: `timeout=86400`

### Issue: "Query execution failed"

**Solution**:
1. Check that OpenAI and Financial Datasets API keys are valid
2. Verify the agent environment was set up correctly
3. Check the error message in `result['error']`

### Issue: "Can't reconnect to paused sandbox"

**Solution**:
1. Paused sandboxes expire after 30 days
2. Use `orchestrator.load_state()` to restore tracking
3. Verify sandbox ID is correct

## Performance Tips

1. **Use agent pools for parallel queries**: 5-10x faster than sequential
2. **Enable persistent agents for frequent use**: Saves setup time
3. **Pause agents between sessions**: Free when paused
4. **Batch similar queries**: Reduces agent creation overhead
5. **Monitor API usage**: Set up alerts for costs

## Security Best Practices

1. **Never commit `.env` to git**: Already in `.gitignore`
2. **Rotate API keys regularly**: Especially if exposed
3. **Use read-only tokens where possible**: Limit permissions
4. **Monitor E2B dashboard**: Check for unusual activity
5. **Implement rate limiting**: Prevent runaway costs

## Next Steps

1. Read the full architecture documentation: `REMOTE_AGENT_ARCHITECTURE.md`
2. Explore the example scripts in `examples/`
3. Customize the orchestrator for your needs
4. Set up monitoring and logging
5. Deploy to production

## Getting Help

- **Documentation**: See `REMOTE_AGENT_ARCHITECTURE.md`
- **Issues**: Check existing issues or create a new one
- **E2B Support**: https://e2b.dev/docs
- **Dexter Repository**: https://github.com/virattt/dexter

## Advanced Topics

### Custom Tool Integration

Add your own financial tools:

```python
# In src/dexter/tools/custom.py
from langchain.tools import Tool

def my_custom_tool(ticker: str) -> str:
    # Your logic here
    return f"Custom analysis for {ticker}"

# Register in src/dexter/tools/__init__.py
TOOLS.append(my_custom_tool)
```

### Webhook Integration

Set up GitHub webhooks to update agents automatically:

```python
from remote_agent.github_integration import GitHubIntegration

github = GitHubIntegration(token, owner, repo)
webhook = github.create_webhook(
    webhook_url="https://your-server.com/webhook",
    events=["push", "release"]
)
```

### Custom Logging

Integrate with your logging infrastructure:

```python
import logging
from remote_agent.orchestrator import RemoteAgentOrchestrator

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('remote_agent.log'),
        logging.StreamHandler()
    ]
)

# Use orchestrator normally
orchestrator = RemoteAgentOrchestrator()
```

---

**Ready to build something amazing? Start with the simple example and scale up!**
