import readline from "node:readline";
import { openai } from "@ai-sdk/openai";
import { createConnection, createInMemoryEvmKeyStore, createKeyStoreInteractor } from "@chromia/ft4";
import { getOnChainTools } from "@goat-sdk/adapter-vercel-ai";
import { sendCHR } from "@goat-sdk/wallet-chromia";
import { CHROMIA_CONFIG, chromia } from "@goat-sdk/wallet-chromia";
import { generateText } from "ai";
import chalk from "chalk";
import { type KeyPair, createClient } from "postchain-client";
import { z } from "zod";
import { MASTER_PROMPT, getLiveTokenPrice } from "./tools";
require("dotenv").config();

const chromiaNetwork = process.env.CHROMIA_NETWORK?.toLowerCase() as keyof typeof CHROMIA_CONFIG;
const privateKey = process.env.EVM_PRIVATE_KEY;

if (!chromiaNetwork || !(chromiaNetwork in CHROMIA_CONFIG)) {
    throw new Error("CHROMIA_NETWORK must be set to 'mainnet' or 'testnet' in the environment.");
}

if (!privateKey) {
    throw new Error("EVM_PRIVATE_KEY is not set in the environment");
}

const config = CHROMIA_CONFIG[chromiaNetwork];

async function chat(tools: object) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    const askQuestion = (query: string): Promise<string> => {
        return new Promise((resolve) => {
            rl.question(chalk.green.bold(query), (answer) => {
                resolve(answer);
            });
        });
    };

    const initialPriceData = await getLiveTokenPrice();
    const formattedPriceData = `CHR Price: $${initialPriceData.chromaway.usd.toFixed(3)}
    Market Cap: $${(initialPriceData.chromaway.usd_market_cap / 1000000).toFixed(2)}M
    24h Volume: $${(initialPriceData.chromaway.usd_24h_vol / 1000000).toFixed(2)}M
    24h Change: ${initialPriceData.chromaway.usd_24h_change.toFixed(2)}%`;

    let conversation = [
        {
            role: "system",
            content: MASTER_PROMPT(formattedPriceData),
        },
    ];

    const enhancedTools = {
        ...tools,
        getLiveTokenPrice: {
            name: "getLiveTokenPrice",
            description: "Gets the current CHR token price",
            parameters: z.object({}),
            execute: async () => {
                const price = await getLiveTokenPrice();
                return `The current price of CHR is $${formattedPriceData}`;
            },
        },
    };

    while (true) {
        const result = await generateText({
            model: openai("gpt-4o-mini"),
            tools: enhancedTools,
            maxSteps: 10,
            prompt: conversation
                .map((msg) => `${msg.role === "system" ? "" : `${msg.role}: `}${msg.content}`)
                .join("\n"),
        });

        console.log(chalk.blue.bold("CHRA:"), result.text);

        const userInput = await askQuestion("You: ");
        if (userInput.toLowerCase() === "exit") {
            rl.close();
            break;
        }

        conversation = [
            conversation[0],
            ...conversation.slice(-3).filter((msg) => msg.role !== "system"),
            { role: "user", content: userInput },
            { role: "assistant", content: result.text },
        ];
    }
}

(async () => {
    const chromiaClient = await createClient({
        nodeUrlPool: config.NODE_URL_POOL,
        blockchainRid: config.ECONOMY_CHAIN_BRID,
    });
    const connection = createConnection(chromiaClient);
    const evmKeyStore = createInMemoryEvmKeyStore({
        privKey: Buffer.from(privateKey, "hex"),
    } as KeyPair);
    const keystoreInteractor = createKeyStoreInteractor(chromiaClient, evmKeyStore);
    const accounts = await keystoreInteractor.getAccounts();
    const accountAddress = accounts[0].id.toString("hex");
    console.log("ACCOUNT ADDRESS: ", accountAddress);

    const baseTools = await getOnChainTools({
        wallet: chromia({
            client: chromiaClient,
            accountAddress,
            keystoreInteractor,
            assetId: config.CHR_ASSET_ID,
            connection,
        }),
        plugins: [sendCHR()],
    });

    const enhancedTools = {
        ...baseTools,
        getTransactionLink: {
            name: "getTransactionLink",
            description: "Gets the transaction explorer link",
            parameters: z.object({
                txHash: z.string(),
            }),
            execute: async ({ txHash }: { txHash: string }) => {
                return `https://explorer.chromia.com/tx/${txHash}`;
            },
        },
    };

    await chat(enhancedTools);
})();
