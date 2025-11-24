<div align="center">
<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</div>

# Eleven Labs Conversational Agent
## 🚀 Quickstart

This quickstart builds a **conversational agent** with ElevenLabs that can read your wallet address, query the balance in your wallet, and recommend tokens to buy, based on the trending tokens of the day using the [Coingecko Plugin](https://github.com/goat-sdk/goat/tree/main/typescript/packages/plugins/coingecko). Works on both Solana and EVM networks.

This quickstart is based on the ElevenLabs base project described [here](https://elevenlabs.io/docs/conversational-ai/guides/conversational-ai-guide-nextjs) and implements all functionalities using tool calling the way it's described [here](https://elevenlabs.io/docs/conversational-ai/customization/client-tools).

## Requirements
1. Create an agent on [ElevenLabs](https://elevenlabs.io/app/conversational-ai)
2. Create a [Coingecko demo account API key](https://www.coingecko.com/en/developers/dashboard)

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
cd examples/by-framework/eleven-labs
```

4. Copy the `.example.env` and populate with your values:
```bash
cp .example.env .env
```
- `NEXT_PUBLIC_ELEVEN_LABS_AGENT_ID`
- `NEXT_PUBLIC_COINGECKO_API_KEY`

5. ElevenLabs requires you to register each tool manually through the ElevenLabs dashboard. To make it easier, we've added a `logTools` option to the `getOnChainTools` function. This will log the tools with their respective descriptions and parameters to the console.

```typescript
const tools = await getOnChainTools({
    wallet: viem(wallet),
    options: {
        logTools: true,
    },
});
```
When you load the site, the console will log each tool that is called, which you would need to add into your agent's dashboard as a `client tool`. The logs will look something like this:

```
get_eth_balance
Description: This tool returns the ETH balance of an EVM wallet.
Parameters:
- address (optional) (string): The address to get the balance of, defaults to the address of the wallet
```

Add it in the Eleven Labs Agent console like so:
<img width="596" alt="Screenshot 2024-12-09 at 6 03 51 PM" src="https://github.com/user-attachments/assets/7ea1a9f0-fc45-4f5b-921c-502d89734cfd">

6. Finally, run the app with `pnpm dev`, connect your wallet, and start the conversation!

<footer>
<br/>
<br/>
<div>
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">

<div>
</footer>
