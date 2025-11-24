# Installation and Usage

## Installation

1. Install the core package

```bash
pip install goat-sdk
```

2. Depending on the type of wallet you want to use, install the corresponding wallet (see all wallets [here](https://github.com/goat-sdk/goat/tree/main#chains-and-wallets)):

```bash
pip install goat-sdk-wallet-solana
```

1. Install the adapter for the agent framework you want to use (see all available adapters [here](https://github.com/goat-sdk/goat/tree/main#agent-frameworks))

```bash
pip install goat-sdk-adapter-langchain
```

## Usage

1. Configure your wallet

```python
from goat_wallets.solana import solana

# Initialize Solana client and wallet
client = SolanaClient(os.getenv("SOLANA_RPC_ENDPOINT"))
keypair = Keypair.from_base58_string(os.getenv("SOLANA_WALLET_SEED") or "")
wallet = solana(client, keypair)
```

2. Configure your tools for the framework you want to use

```python
# Initialize tools with Solana wallet
tools = get_on_chain_tools(
    wallet=wallet,
    plugins=[]
)
```

3. Plug into your agent framework

```python
agent = create_tool_calling_agent(llm, tools, prompt)
agent_executor = AgentExecutor(
    agent=agent, tools=tools, handle_parsing_errors=True, verbose=True
)

response = agent_executor.invoke(
    {
        "input": "Send 10 USDC to ohmygoat.sol",
    }
)

print(response)
```

For concrete examples of how to use GOAT checkout our [quickstart guides](https://github.com/goat-sdk/goat/tree/main#-quickstarts).
