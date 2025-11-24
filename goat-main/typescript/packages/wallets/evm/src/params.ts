import { z } from "zod";

// --- Base Wallet Tool Schemas (Overridden or Used) ---

export const getBalanceParametersSchema = z.object({
    address: z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address format")
        .describe("The wallet address to check the balance for."),
    tokenAddress: z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address format")
        .optional()
        .describe(
            "Optional: The contract address of the ERC20 token. If omitted, the native currency balance is returned.",
        )
        .transform((addr) => addr as `0x${string}` | undefined),
});

// --- EVM Specific Tool Schemas ---

export const sendTokenParametersSchema = z.object({
    recipient: z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address format")
        .describe("The recipient's EVM address.")
        .transform((addr) => addr as `0x${string}`),
    amountInBaseUnits: z
        .string()
        .describe("The amount of the token/native currency to send (in base units, e.g., '1000000000000000000')."),
    tokenAddress: z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address format")
        .optional()
        .describe("Optional: The contract address of the ERC20 token to send. If omitted, the native currency is sent.")
        .transform((addr) => addr as `0x${string}` | undefined),
});

export const getTokenInfoByTickerParametersSchema = z.object({
    ticker: z.string().describe("The ticker symbol of the token (e.g., 'ETH', 'USDC')."),
});

export const convertToBaseUnitsParametersSchema = z.object({
    amount: z.string().describe("The amount to convert (in human-readable units)."),
    tokenAddress: z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address format")
        .optional()
        .describe("Optional: The contract address of the token. If omitted, native currency decimals are used.")
        .transform((addr) => addr as `0x${string}` | undefined),
});

export const convertFromBaseUnitsParametersSchema = z.object({
    amount: z
        .string()
        .regex(/^\d+$/, "Amount must be a non-negative integer string (base units).")
        .describe("The amount to convert (in base units, e.g., wei)."),
    tokenAddress: z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address format")
        .optional()
        .describe("Optional: The contract address of the token. If omitted, native currency decimals are used.")
        .transform((addr) => addr as `0x${string}` | undefined),
});

// Schema for signTypedData (Matches structure used in existing getCoreTools)
// Note: Using passthrough() for flexibility, define specific fields if structure is stable
export const signTypedDataParametersSchema = z
    .object({
        domain: z.object({}).passthrough(),
        types: z.object({}).passthrough(),
        primaryType: z.string(),
        message: z.object({}).passthrough(),
    })
    .passthrough()
    .describe("The EIP-712 typed data structure to sign.");

export const getTokenAllowanceParametersSchema = z.object({
    tokenAddress: z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address format")
        .describe("The contract address of the ERC20 token.")
        .transform((addr) => addr as `0x${string}`),
    owner: z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address format")
        .describe("The address of the token owner.")
        .transform((addr) => addr as `0x${string}`),
    spender: z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address format")
        .describe("The address of the potential spender.")
        .transform((addr) => addr as `0x${string}`),
});

export const approveParametersSchema = z.object({
    tokenAddress: z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address format")
        .describe("The contract address of the ERC20 token.")
        .transform((addr) => addr as `0x${string}`),
    spender: z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address format")
        .describe("The address to grant approval to.")
        .transform((addr) => addr as `0x${string}`),
    amount: z
        .string()
        .regex(/^\d+$/, "Amount must be a non-negative integer string (base units).")
        .describe("The amount of tokens to approve (in base units)."),
});

export const revokeApprovalParametersSchema = z.object({
    tokenAddress: z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address format")
        .describe("The contract address of the ERC20 token.")
        .transform((addr) => addr as `0x${string}`),
    spender: z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address format")
        .describe("The address whose approval should be revoked.")
        .transform((addr) => addr as `0x${string}`),
});
