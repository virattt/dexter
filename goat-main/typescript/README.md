<div>
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">

<div>
<img src="https://img.shields.io/npm/dm/%40goat-sdk%2Fcore" alt="NPM Downloads">

<img src="https://img.shields.io/github/license/goat-sdk/goat" alt="GitHub License">
</div>
<div>
<img src="https://img.shields.io/badge/v20.12.2-1?label=typescript&color=blue" alt="Typescript Version">

<img src="https://img.shields.io/pypi/pyversions/goat-sdk" alt="PyPI - Python Version">
</div>

<br>
<div align="center">
<div style="margin-bottom: 5px;">
<b>Sponsored by</b>
</div>
<div>
<a href="https://www.crossmint.com" target="_blank"> <img src="https://github.com/user-attachments/assets/f3bdfbe3-2a87-48ec-aacb-a5e72737018c" alt="Crossmint logo" width="180px" height="auto" style="object-fit: contain;"></a>
</div>
</div>

## Table of Contents
- [🐐 Overview](#-overview)
- [🚀 Quickstarts](#-quickstarts)
- [🛠️ Supported tools and frameworks](#️-supported-tools-and-frameworks)
- [💻 Contributing](#-contributing)
- [🤝 Community](#-community)

# 🐐 Overview
GOAT is the **largest agentic finance toolkit** for AI agents. 

**Create agents that can:**
- Send and receive payments
- Purchase physical and digital goods and services
- Engage in various investment strategies:
  - Earn yield
  - Bet on prediction markets
  - Purchase crypto assets
- Tokenize any asset
- Get financial insights

**How it works**

GOAT leverages blockchains, cryptocurrencies (such as stablecoins), and wallets as the infrastructure to enable agents to become economic actors:
1. Give your agent a **[wallet](https://github.com/goat-sdk/goat/tree/main#chains-and-wallets)**
2. Allow it to transact **[anywhere](https://github.com/goat-sdk/goat/tree/main#chains-and-wallets)**
3. Use more than **[+200 tools](https://github.com/goat-sdk/goat/tree/main#tools)**
4. Use it with **[any agent framework](https://github.com/goat-sdk/goat/tree/main#agent-frameworks)** of your choice

See everything GOAT supports [here](#️-supported-tools-and-frameworks).

**Lightweight and extendable**

Different from other toolkits, GOAT is designed to be lightweight and extendable by keeping its core minimal and allowing you to **install only the tools you need**.

If you don't find what you need on our more than 200 integrations you can easily:
1. Create your own plugin
2. Integrate a new chain
3. Integrate a new wallet
4. Integrate a new agent framework

See how to do it [here](#-contributing).

**License**

GOAT is free software, MIT licensed.

# 🚀 Quickstarts

***NOTE**: While a quickstart may be implemented for a specific chain, wallet and agent framework, GOAT's flexibility allows you to easily adapt it to any chain, wallet and agent framework without difficulty.*

- **By use case**
  - **Money transmission**
    - Send and receive payments [[EVM](https://github.com/goat-sdk/goat/tree/main/typescript/examples/by-use-case/evm-send-and-receive-tokens), [Solana](https://github.com/goat-sdk/goat/tree/main/typescript/examples/by-use-case/solana-send-and-receive-tokens), [Chromia](https://github.com/goat-sdk/goat/tree/main/typescript/examples/by-use-case/chromia-send-and-receive-tokens), [Cosmos](https://github.com/goat-sdk/goat/tree/main/typescript/examples/by-use-case/cosmos-send-and-receive-tokens), [Fuel](https://github.com/goat-sdk/goat/tree/main/typescript/examples/by-use-case/fuel-send-and-receive-tokens), [Radix](https://github.com/goat-sdk/goat/tree/main/typescript/examples/by-use-case/radix-send-and-receive-tokens), [Zetrix](https://github.com/goat-sdk/goat/tree/main/typescript/examples/by-use-case/zetrix-send-and-receive-tokens)]
  - **Commerce**
    - Purchase any item on Amazon [[EVM](https://github.com/goat-sdk/goat/tree/main/typescript/examples/by-use-case/evm-purchase-on-amazon), [Solana](https://github.com/goat-sdk/goat/tree/main/typescript/examples/by-use-case/solana-purchase-on-amazon)]
  - **Investing**
    - Earn yield [[EVM](https://github.com/goat-sdk/goat/tree/main/typescript/examples/by-use-case/evm-defi-agent), [Solana](https://github.com/goat-sdk/goat/tree/main/typescript/examples/by-use-case/solana-defi-agent)]
    - Prediction markets [[EVM](https://github.com/goat-sdk/goat/tree/main/typescript/examples/by-use-case/evm-bet-on-polymarket)]
    - Purchase crypto assets [[EVM](https://github.com/goat-sdk/goat/tree/main/typescript/examples/by-use-case/evm-swap-tokens), [Solana](https://github.com/goat-sdk/goat/tree/main/typescript/examples/by-use-case/solana-swap-tokens)]
  - **Tokenization**
    - Tokenize non-fungible assets [[EVM](https://github.com/goat-sdk/goat/tree/main/typescript/examples/by-use-case/evm-mint-nft), [Solana](https://github.com/goat-sdk/goat/tree/main/typescript/examples/by-use-case/solana-mint-nft)]
    - Tokenize fungible assets [[Solana](https://github.com/goat-sdk/goat/tree/main/typescript/examples/by-use-case/solana-launch-token)]
- **By framework**
  - [Vercel AI](https://github.com/goat-sdk/goat/tree/main/typescript/examples/by-framework/vercel-ai)
  - [Langchain](https://github.com/goat-sdk/goat/tree/main/typescript/examples/by-framework/langchain)
  - [LlamaIndex](https://github.com/goat-sdk/goat/tree/main/typescript/packages/adapters/llamaindex)
  - [MCP (Model Context Protocol)](https://github.com/goat-sdk/goat/tree/main/typescript/examples/by-framework/model-context-protocol)
  - [Voice agent with ElevenLabs](https://github.com/goat-sdk/goat/tree/main/typescript/examples/by-framework/eleven-labs)
  - [Mastra](https://github.com/goat-sdk/goat/tree/main/typescript/examples/by-framework/mastra)
  - [OpenAI GPT via REST API](https://github.com/goat-sdk/goat/tree/main/typescript/examples/by-framework/chatgpt)
  - [Eliza Agent](https://github.com/goat-sdk/goat/tree/main/typescript/examples/by-framework/eliza)
  - [GAME Agent](https://github.com/goat-sdk/goat/tree/main/typescript/examples/by-framework/virtuals-game)
- **By wallet**
  - [Crossmint Smart Wallets](https://github.com/goat-sdk/goat/tree/main/typescript/examples/by-wallet/crossmint-smart-wallets)
  - [Crossmint Custodial Wallets](https://github.com/goat-sdk/goat/tree/main/typescript/examples/by-wallet/crossmint-solana-custodial-wallets)
  - [Lit](https://github.com/goat-sdk/goat/tree/main/typescript/examples/by-wallet/lit)
  - [Safe](https://github.com/goat-sdk/goat/tree/main/typescript/examples/by-wallet/safe)

- **See all typescript quickstarts [here](https://github.com/goat-sdk/goat/tree/main/typescript/examples).**

# 🛠️ Supported tools and frameworks
- See [here the full list of supported tools and frameworks](https://github.com/goat-sdk/goat/tree/main#️-supported-tools-and-frameworks)

# 💻 Contributing
Do you want a protocol, chain, wallet or agent framework to be supported?

See guides on how to do that here:
- [How to set up the project locally](https://github.com/goat-sdk/goat/tree/main/typescript/docs/2-set-up-the-project-locally.md)
- [How to create a plugin](https://github.com/goat-sdk/goat/tree/main/typescript/docs/3-create-a-plugin.md)
- [How to add a new chain](https://github.com/goat-sdk/goat/tree/main/typescript/docs/4-add-a-new-chain.md)
- [How to add a new wallet provider](https://github.com/goat-sdk/goat/tree/main/typescript/docs/5-add-a-wallet-provider.md)

# 🤝 Community
- Follow us on [X](https://x.com/goat_sdk)
- Join our [Discord](https://discord.gg/goat-sdk)
