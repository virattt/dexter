<div align="center">
<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</div>

# GOAT SDK with Smolagents Example

This example demonstrates how to use the GOAT SDK with [Smolagents](https://github.com/huggingface/smolagents) to build an agent that can interact with blockchain tools.

## Prerequisites

Before running this example, you need to:

1. Have a Solana wallet with a valid keypair
2. Access to a Solana RPC endpoint
3. Have [Poetry](https://python-poetry.org/docs/#installation) installed

## Installation

```bash
# Install dependencies using Poetry
poetry install
```

If you're not using the provided Poetry environment, you can install the dependencies manually:

```bash
# Install with Poetry
poetry add goat-sdk goat-sdk-adapter-smolagents smolagents solders solana-sdk python-dotenv
```

## Configuration

Create a `.env` file in this directory with the following variables:

```
SOLANA_RPC_ENDPOINT=<your-solana-rpc-endpoint>
SOLANA_WALLET_SEED=<your-wallet-private-key>
OPENAI_API_KEY=<your-openai-api-key>  # For using OpenAI models
# HF_MODEL_NAME=microsoft/phi-3-mini-4k-instruct  # For using HuggingFace models
# HF_API_TOKEN=<your-huggingface-token>  # Optional, for accessing gated models
```

The `SOLANA_WALLET_SEED` should be a base58-encoded private key of your Solana wallet.

### Model Selection

SmolaGents provides multiple model providers that you can use with GOAT:

#### 1. OpenAI Models (Default in this example)
By default, this example uses OpenAI's GPT-4o model, which offers excellent capabilities for agent interaction. To use OpenAI models:
```
OPENAI_API_KEY=<your-openai-api-key>
```

#### 2. HuggingFace API Models
You can use models hosted on HuggingFace's Inference API by providing:
```
# Comment out or remove OPENAI_API_KEY
HF_MODEL_NAME=mistralai/Mistral-7B-Instruct-v0.2
HF_API_TOKEN=<your-huggingface-token>  # Optional, for accessing gated models
```

#### 3. Local Models
SmolaGents supports running models locally (requires modifying the example script):
```python
from smolagents import TransformersModel, ToolCallingAgent

model = TransformersModel(
    model_id="microsoft/phi-3-mini-4k-instruct",
    # Additional configuration like device, quantization, etc.
)
```

#### 4. VLLM Deployment
For high-performance inference with VLLM:
```python
from smolagents import VLLMModel, ToolCallingAgent

model = VLLMModel(
    model_id="mistralai/Mistral-7B-Instruct-v0.2",
    server_url="http://localhost:8000"  # Your VLLM server
)
```

Recommended models include:
- OpenAI: `gpt-4o` or `gpt-3.5-turbo` for highest capability
- HuggingFace larger models: `mistralai/Mistral-7B-Instruct-v0.2` 
- HuggingFace smaller models: `microsoft/phi-3-mini-4k-instruct` (3.8B parameters)
- Very small models: `TinyLlama/TinyLlama-1.1B-Chat-v1.0`

## Running the Example

```bash
# Using Poetry
poetry run python example.py
```

This will start an interactive session where you can ask questions about SPL tokens related to your wallet. The agent will use the appropriate tools from GOAT SDK to fetch information from the blockchain and provide answers.

## Example Queries

Here are some example questions you can ask:

- "What is the balance of USDC in my wallet?"
- "Can you tell me more about the SOL token?"
- "How many different tokens do I have in my wallet?"

## How It Works

1. The script initializes a Solana wallet and the SPL Token plugin using GOAT SDK
2. It creates Smolagents-compatible tools using the GOAT adapter
3. It sets up a Smolagents CodeAgent with these tools
4. It runs an interactive loop that processes user questions using the agent

The agent uses the right tools automatically based on the user's query.

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
