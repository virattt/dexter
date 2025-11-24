import { Tool } from "@goat-sdk/core";
import { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { GetBalancesParameters } from "./parameters";
import { AggregatedBalancesAndAllowancesResponse, BalanceServiceParams } from "./types";

export class BalanceService {
    private readonly baseUrl: string;
    private readonly apiKey?: string;

    constructor(params: BalanceServiceParams = {}) {
        this.baseUrl = params.baseUrl ?? "https://api.1inch.dev";
        this.apiKey = params.apiKey;
    }

    @Tool({
        name: "1inch_get_balances",
        description: "Get the balances of a wallet address on a specific chain",
    })
    async getAggregatedBalancesAndAllowances(
        walletClient: EVMWalletClient,
        parameters: GetBalancesParameters,
    ): Promise<AggregatedBalancesAndAllowancesResponse> {
        const { walletAddress } = parameters;
        const chainId = walletClient.getChain().id;

        const url = new URL(
            `${this.baseUrl}/balance/v1.2/${chainId}/balances/${walletAddress ?? walletClient.getAddress()}`,
        );

        const response = await fetch(url.toString(), {
            headers: {
                Accept: "application/json",
                ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` }),
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch balances: ${response.statusText}`);
        }

        return await response.json();
    }
}
