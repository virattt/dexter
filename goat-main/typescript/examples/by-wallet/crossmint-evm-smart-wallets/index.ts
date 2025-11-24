import readline from "node:readline";

import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

import { getOnChainTools } from "@goat-sdk/adapter-vercel-ai";
import { crossmint } from "@goat-sdk/crossmint";

require("dotenv").config();

// 1. Create a wallet client
const apiKey = process.env.CROSSMINT_STAGING_API_KEY;
const walletSignerSecretKey = process.env.SIGNER_WALLET_SECRET_KEY;
const providerUrl = process.env.RPC_PROVIDER_URL;
const smartWalletAddress = process.env.SMART_WALLET_ADDRESS;

if (!apiKey || !walletSignerSecretKey || !providerUrl || !smartWalletAddress) {
    throw new Error("Missing environment variables");
}

const { evmSmartWallet } = crossmint(apiKey);

(async () => {
    // 2. Get your onchain tools for your wallet
    const tools = await getOnChainTools({
        wallet: await evmSmartWallet({
            address: smartWalletAddress,
            signer: {
                secretKey: walletSignerSecretKey as `0x${string}`,
            },
            chain: "base-sepolia",
            provider: providerUrl,
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
