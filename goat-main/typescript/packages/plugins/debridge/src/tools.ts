/**
 * @fileoverview Tools for interacting with the DeBridge protocol
 * Provides functionality for cross-chain token bridging and swaps
 */

import { Tool } from "@goat-sdk/core";
import { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { DebridgeOptions } from "./index";
import {
    OrderIdsResponse,
    OrderStatusResponse,
    SupportedChainsResponse,
    checkTransactionStatusParametersSchema,
    createBridgeOrderParametersSchema,
    executeBridgeTransactionParametersSchema,
    getBridgeQuoteParametersSchema,
    getSupportedChainsParametersSchema,
    getTokenInfoParametersSchema,
} from "./parameters";

/**
 * Core tools for interacting with the DeBridge protocol
 * Provides methods for getting quotes, creating orders, and executing bridge transactions
 */
export class DebridgeTools {
    constructor(private options: DebridgeOptions) {}

    /** Solana's native token (SOL) address in base58 format */
    private static readonly SOLANA_NATIVE_TOKEN = "11111111111111111111111111111111";

    /** EVM native token (ETH/BNB/etc) address */
    private static readonly EVM_NATIVE_TOKEN = "0x0000000000000000000000000000000000000000";

    /**
     * Get a quote for bridging tokens between chains
     * This method provides an estimate of the token amounts and fees for a cross-chain transfer
     *
     * @param {EVMWalletClient} walletClient - The wallet client for transaction signing
     * @param {getBridgeQuoteParametersSchema} parameters - Parameters for the bridge quote
     * @returns {Promise<Object>} Quote information including estimated amounts and fees
     * @throws {Error} If the API request fails or returns an error
     *
     * @example
     * ```typescript
     * const quote = await debridgeTools.getBridgeQuote(wallet, {
     *   srcChainId: "1",
     *   srcChainTokenIn: "0x0000000000000000000000000000000000000000",
     *   srcChainTokenInAmount: "1000000000000000000",
     *   dstChainId: "7565164",
     *   dstChainTokenOut: "DBRiDgJAMsM95moTzJs7M9LnkGErpbv9v6CUR1DXnUu5"
     * });
     * ```
     */
    @Tool({
        name: "get_bridge_quote",
        description:
            "Get a quote for bridging tokens between chains. Use get_token_info first to get correct token addresses.",
    })
    async getBridgeQuote(walletClient: EVMWalletClient, parameters: getBridgeQuoteParametersSchema) {
        try {
            const isSameChain = parameters.srcChainId === parameters.dstChainId;
            const userAddress = await walletClient.getAddress();

            const params = new URLSearchParams();

            if (isSameChain) {
                params.append("chainId", parameters.srcChainId);
                params.append("tokenIn", parameters.srcChainTokenIn);
                params.append("tokenInAmount", parameters.srcChainTokenInAmount);
                params.append("tokenOut", parameters.dstChainTokenOut);
                params.append("tokenOutRecipient", userAddress);
                params.append("slippage", parameters.slippage?.toString() || "auto");
                params.append("referralCode", parameters.referralCode || "21064");
                if (parameters.affiliateFeeRecipient) {
                    params.append("affiliateFeeRecipient", parameters.affiliateFeeRecipient);
                }
                if (parameters.affiliateFeePercent) {
                    params.append("affiliateFeePercent", parameters.affiliateFeePercent.toString());
                }
            } else {
                params.append("srcChainId", parameters.srcChainId);
                params.append("srcChainTokenIn", parameters.srcChainTokenIn);
                params.append("srcChainTokenInAmount", parameters.srcChainTokenInAmount);
                params.append("dstChainId", parameters.dstChainId);
                params.append("dstChainTokenOut", parameters.dstChainTokenOut);
                params.append("dstChainTokenOutAmount", "auto");
                params.append("prependOperatingExpenses", "true");
                params.append("additionalTakerRewardBps", "0");
                params.append("referralCode", parameters.referralCode || "21064");
                if (parameters.affiliateFeeRecipient) {
                    params.append("affiliateFeeRecipient", parameters.affiliateFeeRecipient);
                }
                if (parameters.affiliateFeePercent) {
                    params.append("affiliateFeePercent", parameters.affiliateFeePercent.toString());
                }
            }

            const url = isSameChain
                ? `${this.options.baseUrl}/chain/transaction?${params}`
                : `${this.options.baseUrl}/dln/order/create-tx?${params}`;

            console.log("Making request to:", url);

            const response = await fetch(url);

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, body: ${text}`);
            }

            const data = await response.json();
            console.log("Bridge quote response:", JSON.stringify(data, null, 2));
            if (data.error) {
                throw new Error(data.error);
            }
            return data;
        } catch (error) {
            throw new Error(`Failed to get bridge quote: ${error}`);
        }
    }

    /**
     * Create a bridge order to transfer tokens between chains
     * This method initiates the cross-chain transfer by creating an order on DeBridge
     *
     * @param {createBridgeOrderParametersSchema} parameters - Parameters for creating the bridge order
     * @returns {Promise<Object>} Order details including transaction data and fees
     * @throws {Error} If the API request fails or returns an error
     *
     * @example
     * ```typescript
     * const order = await debridgeTools.createBridgeOrder({
     *   srcChainId: "1",
     *   srcChainTokenIn: "0x0000000000000000000000000000000000000000",
     *   srcChainTokenInAmount: "1000000000000000000",
     *   dstChainId: "7565164",
     *   dstChainTokenOut: "DBRiDgJAMsM95moTzJs7M9LnkGErpbv9v6CUR1DXnUu5",
     *   dstChainTokenOutRecipient: "9ZNXcG5SgqKwQj6uGt9DjmBwzJAhbX9qQH5pHhDFKxJc"
     * });
     * ```
     */
    @Tool({
        name: "create_bridge_order",
        description: `Create a bridge order to transfer tokens between chains.
Use the user requested target asset full address(eg:DBRiDgJAMsM95moTzJs7M9LnkGErpbv9v6CUR1DXnUu5) for dstChainTokenOut do NOT use the ticker(eg:DBR) for dstChainTokenOut

EVM to EVM:
1. Set dstChainTokenOutRecipient to recipient's EVM address
3. Set dstChainTokenOut to the erc-20 format address of the token to receive, not the ticker

To Solana (7565164):
1. Ask for Solana recipient address (base58, e.g. DXu6uARB7gVxqtuwjMyK2mgEchorxDDyrSN9dRK1Af7q)
2. Set dstChainTokenOut to the base58 address of the token to receive on Solana, not the ticker

From Solana:
1. Ask for EVM recipient address (ERC-20 format)
2. Set dstChainTokenOut must be the erc-20 format address of the token to receive, not the ticker`,
    })
    async createBridgeOrder(parameters: createBridgeOrderParametersSchema) {
        try {
            const params = new URLSearchParams();
            params.append("srcChainId", parameters.srcChainId);
            params.append("srcChainTokenIn", parameters.srcChainTokenIn);
            params.append("srcChainTokenInAmount", parameters.srcChainTokenInAmount);
            params.append("dstChainId", parameters.dstChainId);
            params.append("dstChainTokenOut", parameters.dstChainTokenOut);
            params.append("dstChainTokenOutRecipient", parameters.dstChainTokenOutRecipient);
            params.append("senderAddress", parameters.senderAddress);
            // Always use senderAddress for source chain authorities
            params.append("srcChainOrderAuthorityAddress", parameters.senderAddress);
            params.append("srcChainRefundAddress", parameters.senderAddress);
            // Always use dstChainTokenOutRecipient for destination chain authority
            params.append("dstChainOrderAuthorityAddress", parameters.dstChainTokenOutRecipient);
            params.append("referralCode", parameters.referralCode || "21064"); // Analytics
            params.append("deBridgeApp", "GOAT"); // Analytics
            params.append("prependOperatingExpenses", "true");
            if (parameters.affiliateFeeRecipient) {
                params.append("affiliateFeeRecipient", parameters.affiliateFeeRecipient);
            }
            if (parameters.affiliateFeePercent) {
                params.append("affiliateFeePercent", parameters.affiliateFeePercent.toString());
            }

            const url = `${this.options.baseUrl}/dln/order/create-tx?${params}`;

            console.log("Making create bridge order request to:", url);

            const response = await fetch(url);

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, body: ${text}`);
            }

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            // Format the txData to ensure it's properly stringified
            if (data.tx?.data) {
                data.tx.data = data.tx.data.toString();
            }

            return data;
        } catch (error) {
            throw new Error(`Failed to create bridge order: ${error}`);
        }
    }

    /**
     * Get token information from a chain. For EVM: use 0x-prefixed address. For Solana: use base58 token address.
     *
     * @param {getTokenInfoParametersSchema} parameters - Parameters for getting token info
     * @returns {Promise<TokenInfoResponse>} Token information including name, symbol, and decimals
     * @throws {Error} If the API request fails or returns an error
     *
     * @example
     * ```typescript
     * const tokenInfo = await debridgeTools.getTokenInfo({
     *   chainId: "7565164",
     *   tokenAddress: "DBRiDgJAMsM95moTzJs7M9LnkGErpbv9v6CUR1DXnUu5"
     * });
     * ```
     */
    @Tool({
        name: "get_token_info",
        description:
            "Get token information from a chain. For EVM: use 0x-prefixed address. For Solana: use base58 token address.",
    })
    async getTokenInfo(parameters: getTokenInfoParametersSchema) {
        try {
            const url = `${this.options.baseUrl}/token-list?chainId=${parameters.chainId}`;

            console.log("Fetching token information from:", url);

            const response = await fetch(url);

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, body: ${text}`);
            }

            const responseData = await response.json();
            const data = responseData.tokens;

            // Define token data type
            type TokenData = {
                name: string;
                symbol: string;
                decimals: number;
            };

            // If a specific token address is provided, return just that token's info
            if (parameters.tokenAddress) {
                const tokenInfo = data[parameters.tokenAddress];
                if (!tokenInfo) {
                    throw new Error(`Token ${parameters.tokenAddress} not found on chain ${parameters.chainId}`);
                }
                return {
                    name: tokenInfo.name,
                    symbol: tokenInfo.symbol,
                    address: parameters.tokenAddress,
                    decimals: tokenInfo.decimals,
                };
            }

            // Filter tokens by search term
            const searchTerm = parameters.search?.toLowerCase() || "";
            const tokens = Object.entries(data as Record<string, TokenData>)
                .filter(
                    ([, token]: [string, TokenData]) =>
                        token.symbol && (!searchTerm || token.symbol.toLowerCase().includes(searchTerm)),
                )
                .reduce(
                    (acc, [address, token]: [string, TokenData]) => {
                        acc[address] = {
                            name: token.name,
                            symbol: token.symbol,
                            address: address, // Use the full address from the key
                            decimals: token.decimals,
                        };
                        return acc;
                    },
                    {} as Record<
                        string,
                        {
                            name: string;
                            symbol: string;
                            address: string;
                            decimals: number;
                        }
                    >,
                );

            // Log matched tokens with full addresses
            const matchedTokens = Object.values(tokens);
            if (searchTerm && matchedTokens.length > 0) {
                console.log(
                    `Found ${matchedTokens.length} token(s) matching symbol "${searchTerm}":`,
                    JSON.stringify(matchedTokens, null, 2),
                );
            }

            return { tokens };
        } catch (error) {
            console.error("Error fetching token information:", error);
            throw error;
        }
    }

    /**
     * Get a list of supported chains from DeBridge API
     * This method retrieves information about all chains supported by the protocol
     *
     * @param {getSupportedChainsParametersSchema} parameters - Optional parameters
     * @returns {Promise<SupportedChainsResponse>} List of supported chains with their IDs and names
     * @throws {Error} If the API request fails or returns an error
     *
     * @example
     * ```typescript
     * const chains = await debridgeTools.getSupportedChains({});
     * console.log(chains.chains); // List of supported chains
     * ```
     */
    @Tool({
        name: "get_supported_chains",
        description: "Get a list of all chains supported by DeBridge protocol.",
    })
    async getSupportedChains(parameters: getSupportedChainsParametersSchema): Promise<SupportedChainsResponse> {
        try {
            const url = `${this.options.baseUrl}/supported-chains-info`;
            console.log("Making request to:", url);

            const response = await fetch(url);
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, body: ${text}`);
            }

            const data = await response.json();
            console.log("Supported chains response:", JSON.stringify(data, null, 2));
            if (data.error) {
                throw new Error(data.error);
            }
            return data;
        } catch (error) {
            throw new Error(`Failed to get supported chains: ${error}`);
        }
    }

    /**
     * Execute a bridge transaction with the provided transaction data
     * This method signs and sends the transaction to the blockchain
     *
     * @param {EVMWalletClient} walletClient - The wallet client for transaction signing
     * @param {executeBridgeTransactionParametersSchema} parameters - Parameters for executing the bridge transaction
     * @returns {Promise<Object>} Transaction hash and other details
     * @throws {Error} If the transaction fails or returns an error
     *
     * @example
     * ```typescript
     * // Execute transaction using order's tx data
     * const result = await debridgeTools.executeBridgeTransaction(wallet, {
     *   txData: order.tx
     * });
     * ```
     */
    @Tool({
        name: "execute_bridge_transaction",
        description:
            "Execute a bridge transaction using tx data from create_bridge_order tool. Always ask for confirmation before proceeding",
    })
    async executeBridgeTransaction(
        walletClient: EVMWalletClient,
        parameters: executeBridgeTransactionParametersSchema,
    ) {
        try {
            const { txData } = parameters;

            // Validate transaction data
            if (!txData.to || !txData.data) {
                throw new Error("Invalid transaction data: missing 'to' or 'data' field");
            }

            // Validate data format
            if (!txData.data.startsWith("0x")) {
                throw new Error("Invalid transaction data: 'data' field must start with '0x'");
            }

            // Enhanced logging for debugging
            console.log("Executing bridge transaction with data:", {
                to: txData.to,
                value: txData.value ? `${txData.value} (${BigInt(txData.value)})` : "undefined",
                data: {
                    full: txData.data,
                    functionSelector: txData.data.slice(0, 10),
                    parameters: txData.data.slice(10),
                },
            });

            // Send transaction using raw transaction data
            console.log("Sending transaction...");
            const sendRes = await walletClient.sendTransaction({
                to: txData.to as `0x${string}`,
                data: txData.data as `0x${string}`,
                value: txData.value ? BigInt(txData.value) : undefined,
            });

            console.log("Transaction sent! Hash:", sendRes.hash);
            return { hash: sendRes.hash };
        } catch (error) {
            console.error("Bridge transaction execution failed:", error);
            throw new Error(`Failed to execute bridge transaction: ${error}`);
        }
    }

    /**
     * Check the status of bridge transactions
     * This method retrieves the current status of one or more bridge transactions
     *
     * @param {checkTransactionStatusParametersSchema} parameters - Parameters for checking transaction status
     * @returns {Promise<OrderStatusResponse[]>} Status information for the transactions
     * @throws {Error} If the API request fails or returns an error
     *
     * @example
     * ```typescript
     * const status = await debridgeTools.checkTransactionStatus({
     *   orderId: "0x1234567890abcdef"
     * });
     * ```
     */
    @Tool({
        name: "check_transaction_status",
        description: "Check the status of bridge transactions using their order IDs.",
    })
    async checkTransactionStatus(parameters: checkTransactionStatusParametersSchema): Promise<OrderStatusResponse[]> {
        try {
            // First get the order IDs for the transaction
            const orderIdsUrl = `${this.options.baseUrl}/dln/tx/${parameters.txHash}/order-ids`;
            console.log("Getting order IDs from:", orderIdsUrl);

            const orderIdsResponse = await fetch(orderIdsUrl);
            if (!orderIdsResponse.ok) {
                const text = await orderIdsResponse.text();
                throw new Error(`HTTP error! status: ${orderIdsResponse.status}, body: ${text}`);
            }

            const orderIdsData = (await orderIdsResponse.json()) as OrderIdsResponse;
            console.log("Order IDs response:", JSON.stringify(orderIdsData, null, 2));

            if (!orderIdsData.orderIds || orderIdsData.orderIds.length === 0) {
                throw new Error("No order IDs found for this transaction");
            }

            // Then get the status for each order
            const statuses = await Promise.all(
                orderIdsData.orderIds.map(async (orderId) => {
                    const statusUrl = `${this.options.baseUrl}/dln/order/${orderId}/status`;
                    console.log("Getting status from:", statusUrl);

                    const statusResponse = await fetch(statusUrl);
                    if (!statusResponse.ok) {
                        const text = await statusResponse.text();
                        throw new Error(`HTTP error! status: ${statusResponse.status}, body: ${text}`);
                    }

                    const statusData = (await statusResponse.json()) as OrderStatusResponse;
                    // Add the deBridge app link
                    statusData.orderLink = `https://app.debridge.finance/order?orderId=${orderId}`;
                    console.log("Status response:", JSON.stringify(statusData, null, 2));
                    return statusData;
                }),
            );

            return statuses;
        } catch (error) {
            throw new Error(`Failed to check transaction status: ${error}`);
        }
    }
}
