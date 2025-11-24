/**
 * @fileoverview Parameter schemas for DeBridge API interactions
 * Defines and validates the required parameters for various DeBridge operations
 */

import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

/**
 * Regular expressions for validating addresses
 */
const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

/**
 * Chain ID validation schema
 * Based on DLN API v1.0 specification
 * Note: This is a format validation only, the actual supported chains are determined by the API
 */
const chainIdSchema = z.string().refine(
    (val) => {
        // Convert to number for easier comparison
        const num = Number.parseInt(val, 10);
        // Regular chain IDs (1-99999)
        if (num > 0 && num < 100000) return true;
        // Special chain IDs (100000000+)
        if (num >= 100000000) return true;
        // Solana chain ID (7565164)
        if (num === 7565164) return true;
        return false;
    },
    {
        message: "Chain ID must be either 1-99999, 7565164 (Solana), or 100000000+",
    },
);

/**
 * Interface representing a token's information from DeBridge API
 */
export interface TokenInfo {
    /** Token name */
    name: string;
    /** Token symbol */
    symbol: string;
    /** Token address */
    address: string;
    /** Token decimals */
    decimals: number;
}

/**
 * Interface representing the response from getTokenInfo
 */
export interface TokenInfoResponse {
    tokens: Record<string, TokenInfo>;
}

/**
 * Interface representing a chain's information from DeBridge API
 */
export interface ChainInfo {
    /** Chain ID */
    chainId: string;
    /** Original chain ID (may differ for some chains) */
    originalChainId: string;
    /** Chain name */
    chainName: string;
}

/**
 * Interface representing the response from getSupportedChains
 */
export interface SupportedChainsResponse {
    chains: ChainInfo[];
}

/**
 * Schema for parameters required to get token information
 */
export class getTokenInfoParametersSchema extends createToolParameters(
    z.object({
        /** Chain ID to query tokens for */
        chainId: chainIdSchema.describe("Chain ID to get token information for"),

        /** Optional token address to filter results */
        tokenAddress: z.string().optional().describe("Specific token address to query information for"),

        /** Optional search term to filter tokens by name or symbol */
        search: z.string().optional().describe("Search term to filter tokens by name or symbol"),
    }),
) {}

/**
 * Schema for parameters required to get a bridge quote
 * Used to estimate token amounts and fees for cross-chain transfers
 */
export class getBridgeQuoteParametersSchema extends createToolParameters(
    z.object({
        /** Chain ID of the source blockchain */
        srcChainId: chainIdSchema.describe("Source chain ID (e.g., '1' for Ethereum)"),

        /** Token address on the source chain to be bridged */
        srcChainTokenIn: z
            .string()
            .regex(EVM_ADDRESS_REGEX, "Token address must be '0x0' for native token (ETH) or a valid EVM address"),

        /** Amount of tokens to bridge in base units (e.g., wei for ETH) */
        srcChainTokenInAmount: z
            .union([z.literal("auto"), z.string().pipe(z.coerce.number().positive().int().transform(String))])
            .describe("Amount must be 'auto' or a positive integer in token decimals"),

        /** Chain ID of the destination blockchain */
        dstChainId: chainIdSchema
            .refine((val) => val !== "srcChainId", "Destination chain must be different from source chain")
            .describe("Destination chain ID (e.g., '56' for BSC, '7565164' for Solana)"),

        /** Token address on the destination chain to receive */
        dstChainTokenOut: z
            .string()
            .describe("Destination token address (EVM format for EVM chains, native format for Solana)"),

        /** Slippage percentage for the quote */
        slippage: z
            .string()
            .pipe(z.coerce.number().min(0).max(100).transform(String))
            .optional()
            .describe("Slippage must be a valid percentage between 0 and 100"),

        /** Whether to include operating expenses in the quote */
        prependOperatingExpenses: z
            .boolean()
            .optional()
            .default(true)
            .describe(
                "Whether to include operating expenses in the transaction. Always true for native token transfers.",
            ),

        /** Referral code */
        referralCode: z.string().optional(),

        /** Affiliate fee percentage */
        affiliateFeePercent: z.number().optional().describe("Optional: Affiliate fee percentage."),

        /** Affiliate fee recipient */
        affiliateFeeRecipient: z
            .string()
            .regex(EVM_ADDRESS_REGEX, "Affiliate fee recipient must be a valid EVM address")
            .optional()
            .describe("Optional: Affiliate fee recipient."),
    }),
) {}

/**
 * Schema for parameters required to create a bridge order
 * Used to initiate a cross-chain token transfer
 */
export class createBridgeOrderParametersSchema extends createToolParameters(
    z.object({
        /** Chain ID of the source blockchain */
        srcChainId: chainIdSchema.describe(
            "Source chain ID (e.g., '1' for Ethereum, '56' for BSC) where the cross-chain swap will start",
        ),

        /** Token address on the source chain */
        srcChainTokenIn: z
            .string()
            .refine(
                (val) => EVM_ADDRESS_REGEX.test(val) || SOLANA_ADDRESS_REGEX.test(val),
                "Token address must be either a valid EVM address (0x-prefixed) or Solana address (base58)",
            )
            .describe(
                "Token address on source chain. For EVM: use 0x0000000000000000000000000000000000000000 for native token. For Solana: use proper token mint address",
            ),

        /** Amount of tokens to bridge */
        srcChainTokenInAmount: z
            .string()
            .pipe(z.coerce.number().positive().int().transform(String))
            .describe("Amount of input tokens in base units (e.g., wei for ETH, 10^6 for USDT)"),

        /** Chain ID of the destination blockchain */
        dstChainId: chainIdSchema
            .refine((val) => true, {
                message: "Destination chain must be different from source chain",
            })
            .describe("Destination chain ID (e.g., '7565164' for Solana)"),

        /** Token address on the destination chain */
        dstChainTokenOut: z
            .string()
            .refine(
                (val) => EVM_ADDRESS_REGEX.test(val) || SOLANA_ADDRESS_REGEX.test(val),
                "Token address must be either a valid EVM address (0x-prefixed) or Solana address (base58)",
            )
            .describe("Full token address on destination chain."),

        /** Recipient address on the destination chain */
        dstChainTokenOutRecipient: z
            .string()
            .refine(
                (val) => EVM_ADDRESS_REGEX.test(val) || SOLANA_ADDRESS_REGEX.test(val),
                "Recipient address must be either a valid EVM address (0x-prefixed) or Solana address (base58)",
            )
            .describe(
                "Recipient address on destination chain. For EVM: use 0x-prefixed address. For Solana: use base58 wallet address. Required for transaction construction!",
            ),

        /** Sender's address */
        senderAddress: z
            .string()
            .regex(EVM_ADDRESS_REGEX, "Sender address must be a valid EVM address")
            .refine((addr) => addr !== "0x0000000000000000000000000000000000000000", {
                message: "Sender address cannot be the zero address",
            })
            .describe("The user's wallet address that will sign and send the transaction on the source chain"),

        /** Authority address on the source chain */
        srcChainOrderAuthorityAddress: z
            .string()
            .regex(EVM_ADDRESS_REGEX, "Authority address must be a valid EVM address")
            .refine((addr) => addr !== "0x0000000000000000000000000000000000000000", {
                message: "Authority address cannot be the zero address",
            })
            .describe(
                "Optional: The user's wallet address that can cancel/modify the order. If not provided, defaults to senderAddress.",
            )
            .optional(),

        /** Refund address on the source chain */
        srcChainRefundAddress: z
            .string()
            .regex(EVM_ADDRESS_REGEX, "Refund address must be a valid EVM address")
            .refine((addr) => addr !== "0x0000000000000000000000000000000000000000", {
                message: "Refund address cannot be the zero address",
            })
            .describe(
                "Optional: The user's wallet address to receive refunds if the transaction fails. Defaults to senderAddress.",
            )
            .optional(),

        /** Authority address on the destination chain */
        dstChainOrderAuthorityAddress: z
            .string()
            .refine(
                (val) => EVM_ADDRESS_REGEX.test(val) || SOLANA_ADDRESS_REGEX.test(val),
                "Authority address must be either a valid EVM address (0x-prefixed) or Solana address (base58)",
            )
            .refine((addr) => addr !== "0x0000000000000000000000000000000000000000", {
                message: "Authority address cannot be the zero address",
            })
            .describe("Optional: Authority address on destination chain. Defaults to dstChainTokenOutRecipient.")
            .optional(),

        /** Referral code */
        referralCode: z.string().optional(),

        /** Affiliate fee percentage */
        affiliateFeePercent: z.number().optional().describe("Optional: Affiliate fee percentage."),

        /** Affiliate fee recipient */
        affiliateFeeRecipient: z
            .string()
            .regex(EVM_ADDRESS_REGEX, "Affiliate fee recipient must be a valid EVM address")
            .optional()
            .describe("Optional: Affiliate fee recipient."),

        /** Whether to include operating expenses */
        prependOperatingExpenses: z
            .boolean()
            .optional()
            .default(true)
            .describe(
                "Whether to include operating expenses in the transaction. Always true for native token transfers.",
            ),

        /** Optional app identifier */
        deBridgeApp: z.string().optional(),
    }),
) {}

/**
 * Schema for parameters required to execute a bridge transaction
 * Used to submit the final transaction to the blockchain
 */
export class executeBridgeTransactionParametersSchema extends createToolParameters(
    z.object({
        /** Transaction data required for execution */
        txData: z
            .object({
                /** Destination contract address */
                to: z.string().regex(EVM_ADDRESS_REGEX, "Contract address must be a valid EVM address"),

                /** Encoded transaction data */
                data: z.string().regex(/^0x[a-fA-F0-9]*$/, "Transaction data must be valid hex"),

                /** Transaction value in base units */
                value: z
                    .string()
                    .pipe(z.coerce.number().nonnegative().int().transform(String))
                    .optional()
                    .describe("Value must be a non-negative integer in wei"),
            })
            .describe("Transaction data from createBridgeOrder"),
    }),
) {}

/**
 * Schema for parameters required to get supported chains
 * Note: No parameters are required, but Tool decorator requires a parameter schema
 */
export class getSupportedChainsParametersSchema extends createToolParameters(z.object({})) {}

/**
 * Interface representing the response from getOrderIds
 */
export interface OrderIdsResponse {
    orderIds: string[];
}

/**
 * Interface representing the response from getOrderStatus
 */
export interface OrderStatusResponse {
    status:
        | "None"
        | "Created"
        | "Fulfilled"
        | "SentUnlock"
        | "OrderCancelled"
        | "SentOrderCancel"
        | "ClaimedUnlock"
        | "ClaimedOrderCancel";
    orderId: string;
    /** Link to view the order on deBridge app */
    orderLink: string;
}

/**
 * Schema for parameters required to check transaction status
 */
export class checkTransactionStatusParametersSchema extends createToolParameters(
    z.object({
        /** Transaction hash to check status for */
        txHash: z
            .string()
            .regex(/^0x[a-fA-F0-9]{64}$/, "Transaction hash must be a valid hex string")
            .describe("Transaction hash to check status for"),
    }),
) {}
