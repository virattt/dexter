import readline from "node:readline";

import type { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor, createStructuredChatAgent } from "langchain/agents";
import { pull } from "langchain/hub";

import { http, createWalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

import { getOnChainTools } from "@goat-sdk/adapter-langchain";

import { viem } from "@goat-sdk/wallet-viem";

require("dotenv").config();

// 1. Create a wallet client
const account = privateKeyToAccount(process.env.WALLET_PRIVATE_KEY as `0x${string}`);

const walletClient = createWalletClient({
    account: account,
    transport: http(process.env.RPC_PROVIDER_URL),
    chain: baseSepolia,
});

(async (): Promise<void> => {
    // 2. Get your onchain tools for your wallet
    const tools = await getOnChainTools({
        wallet: viem(walletClient),
        plugins: [],
    });

    // 3. Create a readline interface to interact with the agent
    const llm = new ChatOpenAI({
        model: "gpt-4o-mini",
    });

    const prompt = await pull<ChatPromptTemplate>("hwchase17/structured-chat-agent");

    const agent = await createStructuredChatAgent({
        llm,
        tools,
        prompt,
    });

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    const agentExecutor = new AgentExecutor({
        agent,
        tools,
    });

    while (true) {
        const prompt = await new Promise<string>((resolve) => {
            rl.question('Enter your prompt (or "exit" to quit): ', resolve);
        });

        if (prompt === "exit") {
            rl.close();
            break;
        }

        const response = await agentExecutor.invoke({
            input: prompt,
        });

        console.log(response);
    }
})();
