import readline from "node:readline";

import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

import { getOnChainTools } from "@goat-sdk/adapter-vercel-ai";
import { crossmint } from "@goat-sdk/crossmint";
import { Connection, Keypair } from "@solana/web3.js";

import base58 from "bs58";

require("dotenv").config();

// 1. Create a wallet client
const apiKey = process.env.CROSSMINT_STAGING_API_KEY;

const connection = new Connection(process.env.RPC_PROVIDER_URL as string);
const keypair = Keypair.fromSecretKey(base58.decode(process.env.SIGNER_WALLET_SECRET_KEY as string));

const smartWalletAddress = process.env.SMART_WALLET_ADDRESS;

if (!apiKey || !smartWalletAddress) {
    throw new Error("Missing environment variables");
}

const { solanaSmartWallet } = crossmint(apiKey);

(async () => {
    // 2. Get your onchain tools for your wallet
    const tools = await getOnChainTools({
        wallet: await solanaSmartWallet({
            address: smartWalletAddress,
            config: {
                adminSigner: {
                    type: "solana-keypair",
                    keypair,
                },
            },
            connection,
        }),
        plugins: [],
    });

    // 3. Create a readline interface to interact with the agent
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    while (true) {
        const prompt = await new Promise<string>((resolve) => {
            rl.question('Enter your prompt (or "exit" to quit): ', resolve);
        });

        if (prompt === "exit") {
            rl.close();
            break;
        }

        console.log("\n-------------------\n");
        console.log("TOOLS CALLED");
        console.log("\n-------------------\n");
        try {
            const result = await generateText({
                model: openai("gpt-4o-mini"),
                tools: tools,
                maxSteps: 10, // Maximum number of tool invocations per request
                prompt: prompt,
                onStepFinish: (event) => {
                    console.log(event.toolResults);
                },
            });

            console.log("\n-------------------\n");
            console.log("RESPONSE");
            console.log("\n-------------------\n");
            console.log(result.text);
        } catch (error) {
            console.error(error);
        }
        console.log("\n-------------------\n");
    }
})();
