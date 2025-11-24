import * as readline from "node:readline/promises";

import { openai } from "@ai-sdk/openai";
import { type CoreMessage, streamText } from "ai";

import { http } from "viem";
import { createWalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygon } from "viem/chains";

import { getOnChainTools } from "@goat-sdk/adapter-vercel-ai";
import { polymarket } from "@goat-sdk/plugin-polymarket";
import { viem } from "@goat-sdk/wallet-viem";

require("dotenv").config();

// 1. Create a wallet client
const account = privateKeyToAccount(process.env.WALLET_PRIVATE_KEY as `0x${string}`);

const walletClient = createWalletClient({
    account: account,
    transport: http(process.env.RPC_PROVIDER_URL),
    chain: polygon,
});

async function main() {
    // 2. Get your onchain tools for your wallet
    const tools = await getOnChainTools({
        wallet: viem(walletClient),
        plugins: [
            polymarket({
                credentials: {
                    key: process.env.POLYMARKET_API_KEY as string, // API key for Polymarket operations
                    secret: process.env.POLYMARKET_SECRET as string, // API secret for authentication
                    passphrase: process.env.POLYMARKET_PASSPHRASE as string, // API passphrase for security
                },
            }),
        ],
    });

    // 3. Create a readline interface to interact with the agent
    const messages: CoreMessage[] = [];

    const terminal = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    while (true) {
        const userInput = await terminal.question("\nYou: ");
        messages.push({ role: "user", content: userInput });

        try {
            const result = streamText({
                model: openai("gpt-4o-mini"),
                messages,
                tools: tools,
                maxSteps: 5, // Maximum number of tool invocations per request
            });

            let fullResponse = "";
            process.stdout.write("\nAssistant: ");
            for await (const delta of result.textStream) {
                fullResponse += delta;
                process.stdout.write(delta);
            }
            process.stdout.write("\n");

            messages.push({ role: "assistant", content: fullResponse });
        } catch (error) {
            console.error("Error:", error);
            messages.push({
                role: "assistant",
                content: JSON.stringify(error),
            });
        }
    }
}

main().catch(console.error);
