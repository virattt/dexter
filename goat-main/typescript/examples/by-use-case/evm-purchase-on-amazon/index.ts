import readline from "node:readline";

import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { CoreMessage } from "ai";

import { http, createWalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

import { getOnChainTools } from "@goat-sdk/adapter-vercel-ai";
import { crossmintHeadlessCheckout } from "@goat-sdk/plugin-crossmint-headless-checkout";
import { viem } from "@goat-sdk/wallet-viem";

require("dotenv").config();

// 1. Create a wallet client
const account = privateKeyToAccount(process.env.WALLET_PRIVATE_KEY as `0x${string}`);

const walletClient = createWalletClient({
    account: account,
    transport: http(process.env.RPC_PROVIDER_URL),
    chain: baseSepolia,
});

(async () => {
    // 2. Get your onchain tools for your wallet
    const tools = await getOnChainTools({
        wallet: viem(walletClient),
        plugins: [
            // NOTE FOR STAGING ENVIRONMENT:
            // 1. Make sure to use a Crossmint staging API key (from staging.crossmint.com)
            // 2. We're already using the baseSepolia testnet chain above
            crossmintHeadlessCheckout({
                apiKey: process.env.CROSSMINT_API_KEY as string,
            }), // Enable Crossmint headless checkout
        ],
    });

    const systemPrompt = `No need to check the token balance of the user first.

When buying a product:

Always ask for ALL required information in the first response:
1) Name
2) Shipping address
3) Recipient email address
4) Payment method (USDC, SOL, or ETH)
5) Preferred chain (EVM or Solana)
            
Only proceed with the purchase when all information is provided.
1) Use productLocator format 'amazon:B08SVZ775L'
2) Extract product locator from URLs
3) Require and parse valid shipping address (in format 'Name, Street, City, State ZIP, Country') and email
4) The recipient WILL be the email provided by the user
5) You can get the payer address using the get_wallet_address tool
            
Once the order is executed via the buy_token, consider the purchase complete, and the payment sent. You can ask the user if they want to purchase something else

Don't ask to confirm payment to finalize orders.`;

    // Create an array to store conversation history for memory
    const messages: CoreMessage[] = [];

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

        // Add user message to memory
        messages.push({
            role: "user",
            content: [{ type: "text", text: prompt }],
        });

        console.log("\n-------------------\n");
        console.log("TOOLS CALLED");
        console.log("\n-------------------\n");
        try {
            const result = await generateText({
                model: openai("gpt-4o-mini"),
                system: systemPrompt,
                messages: messages, // Pass the conversation history
                tools: tools,
                maxSteps: 10, // Maximum number of tool invocations per request
                onStepFinish: (event) => {
                    console.log(event.toolResults);
                },
            });

            // Add assistant response to memory
            messages.push({
                role: "assistant",
                content: result.text,
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
