import { Tool } from "@goat-sdk/core";
import { StarknetAccountWalletClient } from "@goat-sdk/wallet-starknet";
import {
    ConvertToBaseUnitParameters,
    GetTokenBalanceByAddressParameters,
    GetTokenInfoBySymbolParameters,
    TransferTokenParameters,
} from "./parameters";
import { STARKNET_TOKENS, type StarknetNetwork, type Token } from "./tokens";
import type { StarknetTokenPluginCtorParams } from "./types/StarknetTokenPluginCtorParams";

export class StarknetTokenService {
    private network: StarknetNetwork;
    private tokens: Token[];

    constructor({ network = "mainnet", tokens = STARKNET_TOKENS }: StarknetTokenPluginCtorParams = {}) {
        this.network = network;
        this.tokens = tokens;
    }

    @Tool({
        description: "Get the Starknet token info by its symbol, including the contract address, decimals, and name",
    })
    async getTokenInfoBySymbol(parameters: GetTokenInfoBySymbolParameters) {
        const token = this.tokens.find((token) =>
            [token.symbol, token.symbol.toLowerCase()].includes(parameters.symbol),
        );
        return {
            symbol: token?.symbol,
            contractAddress: token?.addresses[this.network],
            decimals: token?.decimals,
            name: token?.name,
        };
    }

    @Tool({
        description: "Get the balance of a Starknet token by its contract address",
    })
    async getTokenBalanceByAddress(
        walletClient: StarknetAccountWalletClient,
        parameters: GetTokenBalanceByAddressParameters,
    ) {
        try {
            const { walletAddress, tokenAddress } = parameters;

            const result = await walletClient.getClient().callContract({
                contractAddress: tokenAddress,
                entrypoint: "balanceOf",
                calldata: [walletAddress],
            });

            if (!result || !result[0]) {
                throw new Error("Failed to fetch balance");
            }

            // Convert hex string to decimal
            const balanceHex = result[0].toString();
            const balanceDecimal = BigInt(balanceHex).toString();
            return Number(balanceDecimal) / 10 ** parameters.decimals;
        } catch (error) {
            throw new Error(`Failed to get token balance: ${error}`);
        }
    }

    @Tool({
        description: "Transfer a Starknet token by its contract address",
    })
    async transferToken(walletClient: StarknetAccountWalletClient, parameters: TransferTokenParameters) {
        try {
            const { tokenAddress, to, amount } = parameters;

            // Convert amount string to BigInt and encode it as felt
            const amountBigInt = BigInt(amount);

            // Execute the transfer by calling the token contract
            const result = await walletClient.sendTransaction({
                calls: [
                    {
                        contractAddress: tokenAddress,
                        entrypoint: "transfer",
                        // Pass uint256 as two separate felts (low and high)
                        calldata: [
                            to,
                            amountBigInt.toString(10), // low
                            "0", // high
                        ],
                    },
                ],
            });

            if (!result?.hash) {
                throw new Error("Failed to execute transfer");
            }

            return {
                transactionHash: result.hash,
                status: "success",
            };
        } catch (error) {
            throw new Error(`Failed to transfer token: ${error}`);
        }
    }

    @Tool({
        description: "Convert an amount of a Starknet token to its base unit",
    })
    async convertToBaseUnit(parameters: ConvertToBaseUnitParameters) {
        const { amount, decimals } = parameters;
        const baseUnit = amount * 10 ** decimals;
        return baseUnit;
    }
}
