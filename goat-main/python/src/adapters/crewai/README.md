<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# CrewAI Adapter for GOAT

Integrate the more than +200 onchain tools of GOAT with [CrewAI](https://github.com/crewAIInc/crewAI), a framework for orchestrating role-playing, autonomous AI agents.

## Installation

```bash
poetry add goat-sdk-adapter-crewai
```

## Usage

See a full working example [here](https://github.com/goat-sdk/goat/tree/main/python/examples/by-framework/crewai).

```python
# --- Setup GOAT Wallet and Plugins (Example: Solana + SPL Token) ---
import os
from dotenv import load_dotenv
from solders.keypair import Keypair
from solana.rpc.api import Client as SolanaClient
from goat_wallets.solana import solana

load_dotenv()
solana_rpc_endpoint = os.getenv("SOLANA_RPC_ENDPOINT")
solana_wallet_seed = os.getenv("SOLANA_WALLET_SEED")

# Make sure environment variables are set
if not solana_rpc_endpoint or not solana_wallet_seed:
    raise ValueError("SOLANA_RPC_ENDPOINT and SOLANA_WALLET_SEED must be set in .env")

client = SolanaClient(solana_rpc_endpoint)
keypair = Keypair.from_base58_string(solana_wallet_seed)
wallet = solana(client, keypair)

# --- Import CrewAI and the GOAT Adapter ---
from crewai import Agent, Task, Crew, Process
from goat_adapters.crewai.adapter import get_crewai_tools

# --- Generate CrewAI Tools from GOAT ---
goat_crewai_tools = get_crewai_tools(
    wallet=wallet,
    plugins=[]
)

# --- Define CrewAI Agent using GOAT Tools ---
# Ensure OPENAI_API_KEY is set in the environment for CrewAI's default LLM
if not os.getenv("OPENAI_API_KEY"):
    raise ValueError("OPENAI_API_KEY must be set in .env for CrewAI")

crypto_analyst = Agent(
  role='Solana SPL Token Analyst',
  goal='Provide accurate answers about Solana SPL tokens.',
  backstory='Expert analyst for Solana SPL tokens with on-chain tools.',
  verbose=True,
  tools=goat_crewai_tools # Assign the generated tools
)

# --- Define Task and Crew (as needed) ---
task = Task(
    description='What is the balance of USDC for the wallet?',
    expected_output='The USDC balance of the wallet.',
    agent=crypto_analyst
)

crew = Crew(
    agents=[crypto_analyst],
    tasks=[task],
    process=Process.sequential
)

# --- Kick off the Crew ---
# Note: Ensure you have enough SOL for potential transaction fees if tools perform actions.
result = crew.kickoff()
print(result)
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
