<div align="center">
<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</div>

# CrewAI
## 🚀 Quickstart

This example demonstrates how to use GOAT to allow a [CrewAI](https://github.com/crewAIInc/crewAI) agent to **query Solana SPL token balances** using GOAT tools. This example uses the Solana network and the `spl-token` plugin.

You can adapt this example for other agent frameworks, chains, wallets, and GOAT plugins.

## Setup
1. Clone the repository:
```bash
git clone https://github.com/goat-sdk/goat.git
```

2. Go to the example directory:
```bash
cd python/examples/by-framework/crewai
```

3. Copy the `.env.template` and populate with your values:
```bash
cp .env.template .env
```
- `OPENAI_API_KEY` (Required by CrewAI's default configuration)
- `SOLANA_WALLET_SEED` (Your Solana wallet's private key as a base58 string)
- `SOLANA_RPC_ENDPOINT` (Your Solana RPC provider URL)

4. Install dependencies:
```bash
poetry install
```

## Usage
1. Run the example script:
```bash
poetry run python example.py
```

2. The example script demonstrates (interactive):
- Setting up a Solana wallet using GOAT.
- Initializing the `spl-token` GOAT plugin.
- Generating CrewAI-compatible tools using the `goat-sdk-adapter-crewai`.
- Defining a CrewAI agent (`Solana SPL Token Analyst`) equipped with the GOAT tools.
- Defining a CrewAI task to answer user questions about SPL tokens.
- Running an interactive loop where you can ask the agent questions (e.g., "What is the balance of USDC for my wallet?"). The agent will use the GOAT tools to find the answer.

Type 'quit' in the interactive prompt to exit the script.

### Agent Wallets
[Crossmint](https://docs.crossmint.com/wallets/quickstarts/agent-wallets) offers one of the most advanced solutions for agent developers and launchpads: [Agent Wallets](https://docs.crossmint.com/wallets/quickstarts/agent-wallets).

To integrate Agent Wallets with GOAT, check out the following quickstarts:
1. Agent Wallets Quickstart [[EVM](https://github.com/goat-sdk/goat/tree/main/python/examples/by-wallet/crossmint), [Solana](https://github.com/goat-sdk/goat/tree/main/python/examples/by-wallet/crossmint)]
2. [Agent Launchpad Starter Kit](https://github.com/Crossmint/agent-launchpad-starter-kit/)

<footer>
<br/>
<br/>
<div>
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">

<div>
</footer>
