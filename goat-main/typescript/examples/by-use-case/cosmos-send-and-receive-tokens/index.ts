import readline from "node:readline";

import { ChatCohere } from "@langchain/cohere";
import type { ChatPromptTemplate } from "@langchain/core/prompts";
import { AgentExecutor, createStructuredChatAgent } from "langchain/agents";
import { pull } from "langchain/hub";

import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";

import { getOnChainTools } from "@goat-sdk/adapter-langchain";
import { cosmosbank } from "@goat-sdk/plugin-cosmosbank";
import { cosmos } from "@goat-sdk/wallet-cosmos";
import type { CosmosWalletOptions } from "@goat-sdk/wallet-cosmos";

require("dotenv").config();

(async (): Promise<void> => {
    // 1. Create a wallet from the mnemonic
    const mnemonic = process.env.WALLET_MNEMONICS as `0x${string}`;
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(
        mnemonic,
        { prefix: "pryzm" }, // e.g atom, pryzm, pokt, dora e.t.c
    );

    const [Account] = await wallet.getAccounts();
    const rpcEndpoint = process.env.RPC_PROVIDER_URL as `0x${string}`;
    const client = await SigningCosmWasmClient.connectWithSigner(rpcEndpoint, wallet);

    const walletClient: CosmosWalletOptions = {
        client: client,
        account: Account,
    };

    // 2. Get your onchain tools for your wallet
    const tools = await getOnChainTools({
        wallet: cosmos(walletClient),
        plugins: [await cosmosbank()],
    });

    // 3. Create a readline interface to interact with the agent
    const llm = new ChatCohere({
        model: "command-r-plus",
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
