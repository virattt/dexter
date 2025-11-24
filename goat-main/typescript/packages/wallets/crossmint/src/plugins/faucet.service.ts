import { CrossmintApiClient } from "@crossmint/common-sdk-base";
import { Tool, createToolParameters } from "@goat-sdk/core";
import { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { z } from "zod";
import { getTestnetChainNameById } from "../chains";

export class TopUpBalanceParameters extends createToolParameters(
    z.object({
        wallet: z.string().optional().describe("The address to top up the balance of"),
        amount: z.number().min(1).max(100).describe("The amount of tokens to top up"),
    }),
) {}

export class CrossmintFaucetService {
    constructor(private readonly client: CrossmintApiClient) {}

    @Tool({
        description: "Top up your USDC balance",
    })
    async topUpUsdc(walletClient: EVMWalletClient, parameters: TopUpBalanceParameters) {
        const wallet = parameters.wallet ?? walletClient.getAddress();

        const network = walletClient.getChain();

        if (!network.id) {
            throw new Error("Network ID is required");
        }

        const chain = getTestnetChainNameById(network.id);

        if (!chain) {
            throw new Error(`Failed to top up balance: Unsupported chain ${network}`);
        }

        const options = {
            method: "POST",
            headers: {
                ...this.client.authHeaders,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                amount: 10,
                currency: "usdc",
                chain,
            }),
        };

        console.log("options", options);

        const response = await fetch(`${this.client.baseUrl}/api/v1-alpha2/wallets/${wallet}/balances`, options);

        if (response.ok) {
            return "Balance topped up successfully";
        }

        throw new Error(`Failed to top up balance: ${await response.text()}`);
    }
}
