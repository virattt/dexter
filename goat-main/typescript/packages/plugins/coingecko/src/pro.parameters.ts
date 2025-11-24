import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

export class GetPoolDataByPoolAddressParameters extends createToolParameters(
    z.object({
        network: z.string().describe("The network id to get data for (e.g., 'eth', 'polygon_pos')"),
        addresses: z.array(z.string()).describe("The addresses of the pools to get data for"),
    }),
) {}

export class GetTrendingPoolsByNetworkParameters extends createToolParameters(
    z.object({
        network: z.string().describe("The network id to get data for (e.g., 'eth', 'polygon_pos')"),
    }),
) {}

export class GetTrendingPoolsParameters extends createToolParameters(
    z.object({
        include: z
            .array(z.enum(["base_token", "quote_token", "dex", "network"]))
            .describe("The fields to include in the response"),
        page: z.number().max(10).describe("The page number to get trending pools for"),
        duration: z.enum(["24h", "6h", "1h", "5m"]).describe("The duration to get trending pools for"),
    }),
) {}

export class TopGainersLosersParameters extends createToolParameters(
    z.object({
        vsCurrency: z.string().default("usd").describe("The target currency of market data (usd, eur, jpy, etc.)"),
        duration: z
            .enum(["1h", "24h", "7d", "14d", "30d", "60d", "1y"])
            .optional()
            .default("24h")
            .describe("The duration to get top gainers/losers for"),
        topCoins: z
            .enum(["300", "500", "1000", "all"])
            .optional()
            .default("1000")
            .describe("The number of top coins to get"),
    }),
) {}

export class GetTokenDataByTokenAddressParameters extends createToolParameters(
    z.object({
        network: z.string().describe("The network id to get data for (e.g., 'eth', 'polygon_pos')"),
        address: z.string().describe("The address of the token to get data for"),
    }),
) {}

export class GetTokensInfoByPoolAddressParameters extends createToolParameters(
    z.object({
        network: z.string().describe("The network id to get data for (e.g., 'eth', 'polygon_pos')"),
        poolAddress: z.string().describe("The address of the pool to get data for"),
    }),
) {}
