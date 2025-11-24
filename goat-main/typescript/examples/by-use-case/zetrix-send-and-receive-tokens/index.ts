import readline from "node:readline";

import { openai } from "@ai-sdk/openai";
import { getOnChainTools } from "@goat-sdk/adapter-vercel-ai";
import { sendZETRIX, zetrix } from "@goat-sdk/wallet-zetrix";
import { generateText } from "ai";
import ZtxChainSDK from "zetrix-sdk-nodejs";

require("dotenv").config();

(async () => {
    const sdk = new ZtxChainSDK({
        host: "test-node.zetrix.com", // "node.zetrix.com" for mainnet
        secure: true,
    });

    // 2. Get your onchain tools for your wallet
    const tools = await getOnChainTools({
        wallet: zetrix({
            zetrixSDK: sdk,
            zetrixAccount: process.env.ZETRIX_ACCOUNT as string,
            zetrixAccountPrivateKey: process.env.ZETRIX_ACCOUNT_PRIVATE_KEY as string,
        }),
        plugins: [sendZETRIX()],
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
