import { CrossmintApiClient } from "@crossmint/common-sdk-base";
import { Tool } from "@goat-sdk/core";
import {
    CreateWalletForEmailParameters,
    CreateWalletForTwitterUserParameters,
    GetWalletByEmailParameters,
    GetWalletByTwitterUsernameParameters,
} from "./wallets.parameters";

export class WalletsService {
    constructor(private client: CrossmintApiClient) {}

    @Tool({
        description: "Create a new wallet for a Twitter / X user",
    })
    async createWalletForTwitterUser(parameters: CreateWalletForTwitterUserParameters) {
        try {
            const response = await fetch(`${this.client.baseUrl}/api/2022-06-09/wallets`, {
                method: "POST",
                headers: {
                    ...this.client.authHeaders,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    type: `${parameters.chain}-mpc-wallet`,
                    linkedUser: `x:${parameters.username}`,
                }),
            });

            const result = await response.json();

            if (result.error) {
                throw new Error(result.message);
            }

            return result;
        } catch (error) {
            throw new Error(`Failed to create wallet: ${error}`);
        }
    }

    @Tool({
        description: "Create a new wallet for an email address",
    })
    async createWalletForEmail(parameters: CreateWalletForEmailParameters) {
        try {
            const response = await fetch(`${this.client.baseUrl}/api/2022-06-09/wallets`, {
                method: "POST",
                headers: {
                    ...this.client.authHeaders,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    type: `${parameters.chain}-mpc-wallet`,
                    linkedUser: `email:${parameters.email}`,
                }),
            });

            const result = await response.json();

            if (result.error) {
                throw new Error(result.message);
            }

            return result;
        } catch (error) {
            throw new Error(`Failed to create wallet: ${error}`);
        }
    }

    @Tool({
        description: "Get a wallet by Twitter / X username",
    })
    async getWalletByTwitterUsername(parameters: GetWalletByTwitterUsernameParameters) {
        try {
            const response = await fetch(
                `${this.client.baseUrl}/api/2022-06-09/wallets/x:${parameters.username}:${parameters.chain}-mpc-wallet`,
                {
                    headers: {
                        ...this.client.authHeaders,
                        "Content-Type": "application/json",
                    },
                    method: "GET",
                },
            );

            const result = await response.json();

            if (result.error) {
                throw new Error(result.message);
            }

            return result;
        } catch (error) {
            throw new Error(`Failed to get wallet: ${error}`);
        }
    }

    @Tool({
        description: "Get a wallet by email address",
    })
    async getWalletByEmail(parameters: GetWalletByEmailParameters) {
        try {
            const response = await fetch(
                `${this.client.baseUrl}/api/2022-06-09/wallets/email:${parameters.email}:${parameters.chain}-mpc-wallet`,
                {
                    headers: {
                        ...this.client.authHeaders,
                        "Content-Type": "application/json",
                    },
                    method: "GET",
                },
            );

            const result = await response.json();

            if (result.error) {
                throw new Error(result.message);
            }

            return result;
        } catch (error) {
            throw new Error(`Failed to get wallet: ${error}`);
        }
    }
}
