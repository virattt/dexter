// Create a .env file in this directory with:
// DPSN_URL=your_dpsn_url
// DPSN_PRIVATE_KEY=your_dpsn_private_key
// OPENAI_API_KEY=your_openai_key

import readline from "node:readline";
import { openai } from "@ai-sdk/openai";
import { Chain, WalletClientBase, getTools } from "@goat-sdk/core"; // Import necessary core components
import { ToolBase } from "@goat-sdk/core";
import { dpsnplugin } from "@goat-sdk/dpsn-plugin";
import { generateText } from "ai";
import * as dotenv from "dotenv";
import { ZodType, ZodTypeDef } from "zod";

// Define a minimal dummy wallet client for the example
// Replace this with your actual wallet setup (e.g., from @goat-sdk/wallet-evm)
class DummyWalletClient extends WalletClientBase {
    getAddress(): string {
        return "0xDummyAddress";
    }
    getChain(): Chain {
        // The DPSN plugin seems chain-agnostic, but core might require a chain.
        return { type: "evm", id: 1 }; // Example EVM chain
    }
    async signMessage(message: string): Promise<{ signature: string }> {
        console.warn("DummyWalletClient: signMessage called with:", message);
        return { signature: "0xDummySignature" };
    }
    async balanceOf(
        address: string,
    ): Promise<{ decimals: number; symbol: string; name: string; value: string; inBaseUnits: string }> {
        console.warn("DummyWalletClient: balanceOf called for:", address);
        return { decimals: 18, symbol: "ETH", name: "Ether", value: "0", inBaseUnits: "0" };
    }
}

// Load environment variables from .env file
dotenv.config();

async function setupAndRun() {
    // Use the dummy wallet
    const wallet = new DummyWalletClient();
    const dpsn_plugin = dpsnplugin({
        DPSN_URL: process.env.DPSN_URL ?? "",
        EVM_WALLET_PVT_KEY: process.env.EVM_WALLET_PVT_KEY ?? "",
    });
    //declare the dpsn data stream handler for listening to messages on subscribing to dpsn topics
    const DpsnDataStreamHandler = dpsn_plugin.DpsnDataStream;
    DpsnDataStreamHandler.on("message", (message: unknown) => {
        console.log("Received message from DPSN:", message);
        // Add your message processing logic here
    });
    // 1. Get tools array from the core wallet and the DPSN plugin
    const toolsArray = await getTools({
        // Renamed to toolsArray
        wallet: wallet,
        plugins: [
            dpsn_plugin, // Add the DPSN plugin
        ],
    });
    // Convert array to the object format expected by generateText (ToolSet)
    type ToolSet = { [key: string]: ToolBase<ZodType<unknown, ZodTypeDef, unknown>, unknown> };
    const toolSet: ToolSet = {};
    for (const tool of toolsArray) {
        // Assuming tool object has a 'name' property suitable for keying
        if (tool?.name) {
            toolSet[tool.name] = tool;
        }
    }

    console.log(
        "Tools retrieved:",
        Object.keys(toolSet), // Log keys from the new object
    );

    // 2. Create a readline interface to interact with the agent
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    console.log("\n--- Agent Setup Complete ---");
    console.log(
        "Enter prompts like 'subscribe to the 0xe14768a6d8798e4390ec4cb8a4c991202c2115a5cd7a6c0a7ababcaf93b4d2d4/BTCUSDT/ticker topic' or 'exit'",
    );
    //You can select any topic from the DPSN Streams store
    //https://streams.dpsn.org
    // 3. Start the interaction loop
    while (true) {
        const prompt = await new Promise<string>((resolve) => {
            rl.question('Enter your prompt (or "exit" to quit): ', resolve);
        });

        if (prompt.toLowerCase() === "exit") {
            rl.close();
            break;
        }

        console.log("\n-------------------");
        console.log("PROCESSING PROMPT...");
        console.log("\n-------------------");

        try {
            const { text, toolResults, toolCalls, steps } = await generateText({
                model: openai("gpt-4o-mini"),
                tools: toolSet, // Use the converted toolSet object
                maxSteps: 1,
                prompt: prompt,
            });

            // Check if toolResults exist and log them
            if (toolResults && toolResults.length > 0) {
                console.log("TOOL CALLED & RESULTS:");
                console.log(toolResults);

                // toolResults[0].result.on("message", (message: unknown) => {
                //     console.log("Received message from DPSN:", message);
                //     // Add your message processing logic here
                // });
            } else {
                console.log("NO TOOLS CALLED");
                console.log("\n-------------------");
            }
        } catch (error) {
            console.error("Error during generation:", error);
        }
    }
}

setupAndRun().catch(console.error);
