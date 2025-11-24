import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

export class GetTokenInfoBySymbolParameters extends createToolParameters(
    z.object({
        symbol: z.string().describe("The symbol of the token to get the info of"),
    }),
) {}

export class BalanceOfParameters extends createToolParameters(
    z.object({
        tokenAddress: z.string().describe("The address of the ERC1155 token contract"),
        owner: z.string().describe("The address of the token owner"),
        id: z.string().describe("The ID of the token to check the balance of"),
    }),
) {}

export class BalanceOfBatchParameters extends createToolParameters(
    z.object({
        tokenAddress: z.string().describe("The address of the ERC1155 token contract"),
        owners: z.array(z.string()).describe("The addresses of the token owners"),
        ids: z.array(z.string()).describe("The IDs of the tokens to check the balances of"),
    }),
) {}

export class SafeTransferFromParameters extends createToolParameters(
    z.object({
        tokenAddress: z.string().describe("The address of the ERC1155 token contract"),
        from: z.string().describe("The address to transfer the token from"),
        to: z.string().describe("The address to transfer the token to"),
        id: z.string().describe("The ID of the token to transfer"),
        value: z.string().describe("The amount of tokens to transfer"),
        data: z.string().optional().describe("Additional data with no specified format"),
    }),
) {}

export class SafeBatchTransferFromParameters extends createToolParameters(
    z.object({
        tokenAddress: z.string().describe("The address of the ERC1155 token contract"),
        from: z.string().describe("The address to transfer the tokens from"),
        to: z.string().describe("The address to transfer the tokens to"),
        ids: z.array(z.string()).describe("The IDs of the tokens to transfer"),
        values: z.array(z.string()).describe("The amounts of tokens to transfer"),
        data: z.string().optional().describe("Additional data with no specified format"),
    }),
) {}

export class SetApprovalForAllParameters extends createToolParameters(
    z.object({
        tokenAddress: z.string().describe("The address of the ERC1155 token contract"),
        operator: z.string().describe("The address to set approval for"),
        approved: z.boolean().describe("The approval status to set"),
    }),
) {}

export class IsApprovedForAllParameters extends createToolParameters(
    z.object({
        tokenAddress: z.string().describe("The address of the ERC1155 token contract"),
        owner: z.string().describe("The address of the token owner"),
        operator: z.string().describe("The address to check approval for"),
    }),
) {}
