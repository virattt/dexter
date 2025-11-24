import { Tool } from "@goat-sdk/core";
import { EVMWalletClient } from "@goat-sdk/wallet-evm";
import axios from "axios";
import { ERC20_ABI } from "./abi/erc20";
import { getChainId } from "./chain-mapping";
import { GetQuoteParameters } from "./parameters";

const API_URL = "https://li.quest/v1";

export class LifiService {
    constructor(private readonly apiKey?: string) {}

    @Tool({
        name: "lifi_get_quote",
        description: "Get a quote for a cross-chain token transfer using the LiFi API",
    })
    async getQuote(walletClient: EVMWalletClient, parameters: GetQuoteParameters) {
        const { fromChain, toChain, fromToken, toToken, fromAmount } = parameters;

        // Convert chain names to chain IDs
        const fromChainId = getChainId(fromChain);
        const toChainId = getChainId(toChain);

        const requestParams = {
            fromChain: fromChainId,
            toChain: toChainId,
            fromToken,
            toToken,
            fromAmount,
            fromAddress: walletClient.getAddress(),
            slippage: 1,
        };

        try {
            const response = await axios.get(`${API_URL}/quote`, {
                params: requestParams,
                headers: this.apiKey
                    ? {
                          "x-lifi-api-key": this.apiKey,
                      }
                    : undefined,
            });

            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.response?.data?.message === "No available quotes for the requested transfer") {
                    return {
                        error: true,
                        message: `No bridge routes available for ${fromToken} from ${fromChain} to ${toToken} on ${toChain}. Please try a different token pair or chain combination.`,
                    };
                }
                throw new Error(`LiFi API error: ${error.response?.data?.message || error.message}`);
            }
            throw error;
        }
    }

    @Tool({
        name: "lifi_bridge",
        description:
            "Bridge tokens across chains using the LiFi protocol, call this lifi_bridge tool directly when users want to bridge. Approvals are also handled automatically.",
    })
    async bridge(walletClient: EVMWalletClient, parameters: GetQuoteParameters) {
        // First get the quote
        const quoteResponse = await this.getQuote(walletClient, parameters);

        // Check if there was an error finding routes
        if (quoteResponse.error) {
            return quoteResponse;
        }

        // Get the transaction request from the quote
        const { transactionRequest, action } = quoteResponse;

        // First approve the token spend
        await walletClient.sendTransaction({
            to: action.fromToken.address,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [transactionRequest.to, parameters.fromAmount],
        });

        // Execute the bridge transaction
        const finalTxRequest = {
            to: transactionRequest.to,
            data: transactionRequest.data,
        };
        const txResponse = await walletClient.sendTransaction(finalTxRequest);

        return txResponse;
    }
}
