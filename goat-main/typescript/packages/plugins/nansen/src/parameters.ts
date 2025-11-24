import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

export class GetTokenDetailsParams extends createToolParameters(
    z.object({
        address: z.string().describe("Token contract address"),
    }),
) {}

export class GetTokenTradesParams extends createToolParameters(
    z.object({
        address: z.string().describe("Token contract address"),
        start_date: z.string().describe("Start date to filter for (format: YYYY-MM-DD)"),
        end_date: z.string().describe("End date to filter for (format: YYYY-MM-DD)"),
    }),
) {}

export class GetNFTDetailsParams extends createToolParameters(
    z.object({
        token_address: z.string().describe("NFT contract address"),
        nft_id: z.string().describe("Specific NFT token ID"),
    }),
) {}

export class GetNFTTradesParams extends createToolParameters(
    z.object({
        token_address: z.string().describe("NFT contract address"),
        nft_id: z.string().describe("Specific NFT token ID"),
        start_date: z.string().describe("Start date to filter for (format: YYYY-MM-DD)"),
        end_date: z.string().describe("End date to filter for (format: YYYY-MM-DD)"),
    }),
) {}

export class GetSmartMoneyParams extends createToolParameters(
    z.object({
        start_date: z.string().describe("Start date to filter for (format: YYYY-MM-DD)"),
        end_date: z.string().describe("End date to filter for (format: YYYY-MM-DD)"),
        token_address: z.string().optional().describe("Token address to filter by"),
    }),
) {}

export class GetTradingSignalParams extends createToolParameters(
    z.object({
        start_date: z.string().describe("Start date to filter for (format: YYYY-MM-DD)"),
        end_date: z.string().describe("End date to filter for (format: YYYY-MM-DD)"),
        token_address: z.string().optional().describe("Token address to filter by"),
    }),
) {}
