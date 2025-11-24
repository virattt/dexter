// Create a .env file in this directory with:
// DPSN_URL=your_dpsn_url
// DPSN_PRIVATE_KEY=your_dpsn_private_key
// OPENAI_API_KEY=your_openai_key

import { Chain, WalletClientBase, getTools } from "@goat-sdk/core"; // Import necessary core components
import { dpsnplugin } from "@goat-sdk/dpsn-plugin";
import * as dotenv from "dotenv";

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
    const wallet = new DummyWalletClient(); // Use the dummy wallet
    const dpsn_plugin = dpsnplugin({
        DPSN_URL: process.env.DPSN_URL ?? "",
        EVM_WALLET_PVT_KEY: process.env.EVM_WALLET_PVT_KEY ?? "",
    });
    // Get tools from the core wallet and the DPSN plugin
    const tools = await getTools({
        wallet: wallet,
        plugins: [
            dpsn_plugin, // Add the DPSN plugin
        ],
    });
    const DpsnDataStreamHandler = dpsn_plugin.DpsnDataStream;
    DpsnDataStreamHandler.on("message", (message: unknown) => {
        console.log("Received message from DPSN:", message);
        // Add your message processing logic here
    });
    console.log(
        "Tools retrieved:",
        tools.map((t) => t.name),
    );

    // --- Placeholder for Agent Integration ---
    // Here you would typically integrate these 'tools' with your chosen LLM Agent framework
    // For example, using Langchain, OpenAI Functions, or another agent library.

    // Example (conceptual - adapt to your chosen framework):
    // const llm = new ChatOpenAI({ apiKey: process.env.OPENAI_API_KEY }); // Requires langchain
    // const agent = createOpenAIFunctionsAgent({ llm, tools, prompt: yourPromptTemplate });
    // const agentExecutor = new AgentExecutor({ agent, tools });

    // const prompt = "Please subscribe to the DPSN topic: example/data/stream";
    // const result = await agentExecutor.invoke({ input: prompt });
    // console.log("Agent execution result:", result);

    console.log("\n--- Agent Setup Complete ---");
    console.log("Next steps: Integrate the retrieved tools with your LLM agent framework.");
    console.log("The DPSN plugin tool 'dpsn_subscription_plugin' is available.");
    console.log("You can now prompt your agent to use this tool.");

    // Example: If you directly wanted to test the subscribe tool (without an LLM agent)
    const subscribeTool = tools.find((tool) => tool.name === "dpsn_subscription_tool");
    if (subscribeTool) {
        console.log("\n--- Testing DPSN Subscribe Tool Directly ---");
        //You can select any topic from the DPSN Streams store
        //https://streams.dpsn.org
        //Using the topic for  btc price updates from binance top 10 tokens price feed  topic from the DPSN Streams store
        const topicToSubscribe = "0xe14768a6d8798e4390ec4cb8a4c991202c2115a5cd7a6c0a7ababcaf93b4d2d4/BTCUSDT/ticker"; // Replace with your desired topic
        try {
            const result = await subscribeTool.execute({ dpsn_topic: topicToSubscribe });

            // Set up event listener for messages

            console.log(result);
            console.log(`Successfully initiated subscription to topic: ${topicToSubscribe}`);
            console.log("Listening for messages... Press Ctrl+C to exit.");

            // Keep the process running
            await new Promise(() => {});
        } catch (error) {
            console.error("Error executing subscribe tool:", error);
        }
    } else {
        console.warn("Could not find the dpsn_subscription_plugin tool.");
    }
}

setupAndRun().catch(console.error);
