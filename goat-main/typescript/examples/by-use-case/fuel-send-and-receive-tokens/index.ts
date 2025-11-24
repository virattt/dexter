import readline from "node:readline";

import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

import { getOnChainTools } from "@goat-sdk/adapter-vercel-ai";
import { fuel, sendFuelETH } from "@goat-sdk/wallet-fuel";
import { Provider } from "fuels";

require("dotenv").config();

// 1. Create a wallet client
const privateKey = process.env.FUEL_WALLET_PRIVATE_KEY as string;

(async () => {
    const provider = await Provider.create("https://mainnet.fuel.network/v1/graphql");

    // 2. Get your onchain tools for your wallet
    const tools = await getOnChainTools({
        wallet: fuel({
            privateKey,
            provider,
        }),
        plugins: [sendFuelETH()],
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
