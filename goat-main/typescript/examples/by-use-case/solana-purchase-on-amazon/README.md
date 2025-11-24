<div align="center">
<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</div>

# Purchase any item on Amazon using Solana
## 🚀 Quickstart

This example shows you how to create a MCP Server to purchase any item on Amazon US using Solana. It uses the [Crossmint API](https://docs.crossmint.com/reference/introduction) to purchase the item.

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
cd examples/by-use-case/solana-purchase-on-amazon
```

### Configure the MCP server for Claude
1. Copy the `mcp-solana.example.json` file to `mcp-solana.json`:
```bash
cp mcp-solana.example.json mcp-solana.json 
```

2. Update the json file with your values for either EVM or Solana:
- Absolute path to the parent folder of the `model-context-protocol` folder, you can get it by running `pwd` in the `model-context-protocol` folder
- `WALLET_PRIVATE_KEY`
- `RPC_PROVIDER_URL`
- `CROSSMINT_API_KEY` (Note: The project configured for CROSSMINT_API_KEY should be a project that has MPC wallets configured instead of smart wallets. To do this, go to https://www.staging.crossmint.com/console or https://www.crossmint.com/console, and configure type of wallets in the Wallets dropdown.)

3. Copy/update the json file and rename it to `claude_desktop_config.json` file to the `~/Library/Application Support/Claude/` directory:
```bash
cp mcp-solana.json ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

This tells Claude for Desktop:
- There is an MCP server named “goat-solana”
- Launch it by running the specified command

4. Restart Claude for Desktop.

**NOTE**: When making changes to the code you need to make sure to:
1. Run `pnpm build` in the `model-context-protocol` folder to generate the updated `solana.js` file.
2. If you update the json file: copy it again to the `~/Library/Application Support/Claude/` directory, or update the `claude_desktop_config.json` file with the new values. You will also need to restart Claude.

## Usage
1. Run Claude for Desktop

2. Chat with the agent:
- Purchase <link-to-amazon-item>

### Expected JSON Schema for MCP buy_token Tool Response

The MCP buy_token tool should return a response in the following format:

```json
{
  "lineItems": [
    {
      "productLocator": <AMAZON_PRODUCT_LOCATOR>
    }
  ],
  "recipient": {
    "email": <EMAIL>,
    "physicalAddress": {
      "name": <NAME>,
      "line1": <ADDRESS LINE 1>,
      "city": <CITY>,
      "state": <STATE>,
      "postalCode": <POSTAL CODE>,
      "country": "US"
    }
  },
  "payment": {
    "method": <CHAIN_NAME>,
    "currency": <CURRENCY>,
    "payerAddress": <WALLET_ADDRESS>
  }
}
```

For more information on how to use the model context protocol, check out the [docs](https://modelcontextprotocol.io/quickstart/server).

<footer>
<br/>
<br/>
<div>
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">

<div>
</footer>
