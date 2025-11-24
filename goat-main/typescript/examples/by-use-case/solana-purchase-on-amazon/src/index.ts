import { crossmintHeadlessCheckout } from "@goat-sdk/plugin-crossmint-headless-checkout";
import { solana } from "@goat-sdk/wallet-solana";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import { Connection, Keypair } from "@solana/web3.js";

import base58 from "bs58";

import { getOnChainTools } from "@goat-sdk/adapter-model-context-protocol";

// 1. Create the wallet client
const connection = new Connection(process.env.RPC_PROVIDER_URL as string);
const keypair = Keypair.fromSecretKey(base58.decode(process.env.WALLET_PRIVATE_KEY as string));

// 2. Get the onchain tools for the wallet
const toolsPromise = getOnChainTools({
    wallet: solana({
        keypair,
        connection,
    }),
    plugins: [
        crossmintHeadlessCheckout({
            apiKey: process.env.CROSSMINT_API_KEY as string,
        }), // Enable Crossmint headless checkout
    ],
});

// 3. Create and configure the server
const server = new Server(
    {
        name: "goat-solana",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
    const { listOfTools } = await toolsPromise;
    return {
        tools: listOfTools(),
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { toolHandler } = await toolsPromise;
    try {
        return toolHandler(request.params.name, request.params.arguments);
    } catch (error) {
        throw new Error(`Tool ${request.params.name} failed: ${error}`);
    }
});

// 4. Start the server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("GOAT MCP Server running on stdio");
}

main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
