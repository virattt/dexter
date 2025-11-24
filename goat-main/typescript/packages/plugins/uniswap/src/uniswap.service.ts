import { Tool } from "@goat-sdk/core";
import { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { fromHex } from "viem";
import { CheckApprovalBodySchema, GetQuoteParameters } from "./parameters";
import type { UniswapCtorParams } from "./types/UniswapCtorParams";

export class UniswapService {
    constructor(private readonly params: UniswapCtorParams) {}

    private async makeRequest(endpoint: string, parameters: unknown) {
        const url = new URL(`${this.params.baseUrl}/${endpoint}`);

        const response = await fetch(url.toString(), {
            method: "POST",
            body: JSON.stringify(parameters),
            headers: {
                "x-api-key": this.params.apiKey,
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch ${endpoint}: ${JSON.stringify(await response.json(), null, 2)}`);
        }

        return response.json();
    }

    @Tool({
        name: "uniswap_check_approval",
        description:
            "Check if the wallet has enough approval for a token and return the transaction to approve the token. The approval must takes place before the swap transaction",
    })
    async checkApproval(walletClient: EVMWalletClient, parameters: CheckApprovalBodySchema) {
        const data = await this.makeRequest("check_approval", {
            token: parameters.token,
            amount: parameters.amount,
            walletAddress: parameters.walletAddress,
            chainId: walletClient.getChain().id,
        });

        const approval = data.approval;

        if (!approval) {
            return {
                status: "approved",
            };
        }

        const transaction = await walletClient.sendTransaction({
            to: approval.to,
            value: fromHex(approval.value, "bigint"),
            data: approval.data,
        });

        return {
            status: "approved",
            txHash: transaction.hash,
        };
    }

    @Tool({
        name: "uniswap_get_quote",
        description: "Get the quote for a swap",
    })
    async getQuote(walletClient: EVMWalletClient, parameters: GetQuoteParameters) {
        return await this.makeRequest("quote", {
            ...parameters,
            tokenInChainId: walletClient.getChain().id,
            tokenOutChainId: parameters.tokenOutChainId ?? walletClient.getChain().id,
            swapper: walletClient.getAddress(),
        });
    }

    @Tool({
        name: "uniswap_swap_tokens",
        description:
            "Swap tokens on Uniswap. Make sure to check the approval with the uniswap_check_approval tool before calling this tool. No need to call uniswap_get_quote before calling this tool.",
    })
    async swapTokens(walletClient: EVMWalletClient, parameters: GetQuoteParameters) {
        const { quote, permitData } = await this.getQuote(walletClient, parameters);

        let signature: string | undefined;

        if (permitData) {
            signature = (
                await walletClient.signTypedData({
                    domain: permitData.domain,
                    types: permitData.types,
                    primaryType: "PermitSingle",
                    message: permitData.values,
                })
            ).signature;
        }

        const response = await this.makeRequest("swap", {
            signature: signature,
            quote: quote,
            permitData: permitData ?? undefined,
        });

        const swap = response.swap;

        const tx = await walletClient.sendTransaction({
            to: swap.to,
            value: fromHex(swap.value, "bigint"),
            data: swap.data,
        });

        return {
            txHash: tx.hash,
        };
    }
}
