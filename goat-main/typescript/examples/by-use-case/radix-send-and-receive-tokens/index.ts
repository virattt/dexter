import readline from "node:readline";

import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

import { getOnChainTools } from "@goat-sdk/adapter-vercel-ai";
import { RadixWalletClient, sendXrd } from "@goat-sdk/wallet-radix";
import {
    createEd25519KeyPair,
    createRadixWeb3Client,
    deriveAccountAddressFromPublicKey,
    manifests,
} from "radix-web3.js";

require("dotenv").config();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

type Message = {
    role: "user" | "assistant";
    content: string;
};

const keyPair = createEd25519KeyPair();

const keyPair2 = createEd25519KeyPair();

async function chat() {
    const conversationHistory: Message[] = [];
    const accountAddress = await deriveAccountAddressFromPublicKey(keyPair.publicKey(), 2);

    const accountAddress2 = await deriveAccountAddressFromPublicKey(keyPair2.publicKey(), 2);

    console.log({ accountAddress, accountAddress2 });

    const client = createRadixWeb3Client({
        networkId: "Stokenet",
        notaryPublicKey: keyPair.publicKey(),
        notarizer: async (hash) => keyPair.signToSignature(hash),
    });

    // Get some XRD from the faucet
    await client.submitTransaction(manifests.getXrdFromFaucetManifest(accountAddress));

    const tools = await getOnChainTools({
        wallet: new RadixWalletClient({
            accountAddress,
            client,
        }),
        plugins: [sendXrd()],
    });

    console.log("Chat started. Type 'exit' to end the conversation.");

    const askQuestion = () => {
        rl.question("You: ", async (prompt) => {
            if (prompt.toLowerCase() === "exit") {
                rl.close();
                return;
            }

            conversationHistory.push({ role: "user", content: prompt });

            const result = await generateText({
                model: openai("gpt-4o-mini"),
                tools: tools,
                maxSteps: 10, // Maximum number of tool invocations per request
                prompt: `You are a based crypto degen assistant. You're knowledgeable about DeFi, NFTs, and trading. You use crypto slang naturally and stay up to date with Radix DLT ecosystem. You help users with their trades and provide market insights. Keep responses concise and use emojis occasionally.

Previous conversation:
${conversationHistory.map((m) => `${m.role}: ${m.content}`).join("\n")}

Current request: ${prompt}`,
                onStepFinish: (event) => {
                    console.log("Tool execution:");
                    console.log(JSON.stringify(event.toolResults, null, 2));
                },
            });

            conversationHistory.push({
                role: "assistant",
                content: result.text,
            });
            console.log("Assistant:", result.text);
            askQuestion();
        });
    };

    askQuestion();
}

chat().catch(console.error);
