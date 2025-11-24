<div align="center">
<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</div>

# Model Context Protocol
[![smithery badge](https://smithery.ai/badge/@goat-sdk/goat)](https://smithery.ai/server/@goat-sdk/goat)

## 🚀 Quickstart

This example shows you how to create a MCP Server to connect GOAT with Claude for Desktop.

It is implemented for both EVM (Base Sepolia) and Solana chains but can be updated to support any other chain, wallet and series of tools.

## Requirements
- Have Claude for Desktop installed. You can download it from [here](https://claude.ai/download)

## Setup
1. Clone the repository:
```bash
git clone https://github.com/goat-sdk/goat.git && cd goat
```

2. Run the following commands from the `typescript` directory:
```bash
cd typescript
pnpm install
pnpm build
```

3. Go to the example directory:
```bash
cd examples/by-framework/model-context-protocol
```

### Installing via Smithery

To install GOAT for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@goat-sdk/goat):

```bash
npx -y @smithery/cli install @goat-sdk/goat --client claude
```

### Configure the MCP server for Claude
1. Copy the `mcp-evm.example.json` file to `mcp-evm.json`:
```bash
# For EVM
cp mcp-evm.example.json mcp-evm.json 

# For Solana
cp mcp-solana.example.json mcp-solana.json
```

2. Update the json file with your values for either EVM or Solana:
- Absolute path to the parent folder of the `model-context-protocol` folder, you can get it by running `pwd` in the `model-context-protocol` folder
- `WALLET_PRIVATE_KEY`
- `RPC_PROVIDER_URL`

3. Copy/update the json file and rename it to `claude_desktop_config.json` file to the `~/Library/Application Support/Claude/` directory:
```bash
# For EVM
cp mcp-evm.json ~/Library/Application\ Support/Claude/claude_desktop_config.json

# For Solana
cp mcp-solana.json ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

This tells Claude for Desktop:
- There’s are MCP servers named “goat-evm” / “goat-solana”
- Launch it by running the specified command

4. Restart Claude for Desktop.

**NOTE**: When making changes to the code you need to make sure to:
1. Run `pnpm build` in the `model-context-protocol` folder to generate the updated `evm.js` and `solana.js` files.
2. If you update the json file: copy it again to the `~/Library/Application Support/Claude/` directory, or update the `claude_desktop_config.json` file with the new values. You will also need to restart Claude.

## Usage
1. Run Claude for Desktop

2. Chat with the agent:
- Check your balance for ERC-20 tokens
- Send ERC-20 tokens to another address
- Check your balance again to see the tokens you just sent

For more information on how to use the model context protocol, check out the [docs](https://modelcontextprotocol.io/quickstart/server).

<footer>
<br/>
<br/>
<div>
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">

<div>
</footer>
