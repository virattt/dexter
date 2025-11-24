import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

export type NetworkType = "mainnet" | "goerli" | "sepolia";

// Base schemas
export const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
export const networkSchema = z
    .enum(["mainnet", "goerli", "sepolia"] as const)
    .optional()
    .default("mainnet");
export const tagSchema = z.enum(["latest", "pending", "earliest"]).optional().default("latest");
export const blockNumberSchema = z.union([
    z.literal("latest"),
    z.literal("pending"),
    z.literal("earliest"),
    z.number(),
]);
export const txHashSchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/);

// Tool parameters using createToolParameters
export class AccountBalanceParameters extends createToolParameters(
    z.object({
        address: addressSchema,
        tag: tagSchema,
        network: networkSchema,
    }),
) {}

export class AccountTransactionsParameters extends createToolParameters(
    z.object({
        address: addressSchema,
        startBlock: z.number().optional(),
        endBlock: z.number().optional(),
        page: z.number().optional(),
        offset: z.number().optional(),
        sort: z.enum(["asc", "desc"]).optional().default("desc"),
        network: networkSchema,
    }),
) {}

export class ContractABIParameters extends createToolParameters(
    z.object({
        address: addressSchema,
        network: networkSchema,
    }),
) {}

export class ContractSourceCodeParameters extends createToolParameters(
    z.object({
        address: addressSchema,
        network: networkSchema,
    }),
) {}

export class TransactionStatusParameters extends createToolParameters(
    z.object({
        txhash: txHashSchema,
        network: networkSchema,
    }),
) {}

export class TransactionReceiptParameters extends createToolParameters(
    z.object({
        txhash: txHashSchema,
        network: networkSchema,
    }),
) {}

export class BlockByNumberParameters extends createToolParameters(
    z.object({
        blockNumber: blockNumberSchema,
        network: networkSchema,
    }),
) {}

export class TokenBalanceParameters extends createToolParameters(
    z.object({
        address: addressSchema,
        contractAddress: addressSchema,
        tag: tagSchema,
        network: networkSchema,
    }),
) {}

export class GasPriceParameters extends createToolParameters(
    z.object({
        network: networkSchema,
    }),
) {}

export class EventLogsParameters extends createToolParameters(
    z.object({
        address: addressSchema,
        fromBlock: blockNumberSchema.optional(),
        toBlock: blockNumberSchema.optional(),
        topic0: z.string().optional(),
        topic1: z.string().optional(),
        topic2: z.string().optional(),
        topic3: z.string().optional(),
        network: networkSchema,
    }),
) {}
