<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# Smolagents Adapter for GOAT

Integrate the more than +200 onchain tools of GOAT with [Smolagents](https://github.com/huggingface/smolagents), a framework for building agentic systems with small language models.

## Installation

```bash
poetry add goat-sdk-adapter-smolagents
```

## Usage

```python
# --- Setup GOAT Wallet and Plugins (Example: Solana + SPL Token) ---
import os
from dotenv import load_dotenv
from solders.keypair import Keypair
from solana.rpc.api import Client as SolanaClient
from goat_wallets.solana import solana

# Load environment variables
load_dotenv()
solana_rpc_endpoint = os.getenv("SOLANA_RPC_ENDPOINT")
solana_wallet_seed = os.getenv("SOLANA_WALLET_SEED")
openai_api_key = os.getenv("OPENAI_API_KEY")

# Make sure environment variables are set
if not solana_rpc_endpoint or not solana_wallet_seed:
    raise ValueError("SOLANA_RPC_ENDPOINT and SOLANA_WALLET_SEED must be set in .env")

if not openai_api_key:
    raise ValueError("OPENAI_API_KEY must be set in .env to use GPT-4o")

client = SolanaClient(solana_rpc_endpoint)
keypair = Keypair.from_base58_string(solana_wallet_seed)
wallet = solana(client, keypair)

# --- Import Smolagents and the GOAT Adapter ---
from smolagents import OpenAIServerModel, ToolCallingAgent
from goat_adapters.smolagents import get_smolagents_tools

# --- Generate Smolagents Tools from GOAT ---
goat_smolagents_tools = get_smolagents_tools(
    wallet=wallet,
    plugins=[]
)

# --- Define Smolagents Agent using GOAT Tools ---
model = OpenAIServerModel(
    model_id="gpt-4o",
)

agent = ToolCallingAgent(
    tools=goat_smolagents_tools,
    model=model,
    add_base_tools=False  # Don't include Smolagents default tools
)

# Set custom system prompt
agent.prompt_templates["system_prompt"] = (
    "You are an expert analyst focused on the Solana blockchain and its SPL token ecosystem. "
    "You have access to specialized tools that can query SPL token balances and potentially other relevant information directly from the blockchain. "
    "Your task is to understand the user's question, use the appropriate tool(s) if necessary, and provide a clear, concise answer."
)

# --- Run the agent with a specific task ---
result = agent.run("What is the balance of USDC for my wallet?")
print(result)
```

### Tool Collection

You can also create a Smolagents ToolCollection to manage your GOAT tools:

```python
from smolagents import ToolCollection, ToolCallingAgent

# Create the tools first
goat_tools = get_smolagents_tools(wallet=wallet, plugins=[])

# Create a custom tool collection with your GOAT tools
my_tool_collection = ToolCollection(
    tools=goat_tools
)

# Now use this collection with your agent
agent = ToolCallingAgent(
    tools=my_tool_collection.tools,
    model=model,
    add_base_tools=False
)
```

<footer>
<br/>
<br/>
<div>
<a href="https://github.com/goat-sdk/goat">
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">
</a>
<div>
</footer>
