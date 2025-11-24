import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

export class NoParams extends createToolParameters(z.object({})) {}

export class GetCoinPricesParameters extends createToolParameters(
    z.object({
        coinIds: z.array(z.string()).describe("The ID of the coin on CoinGecko (e.g., 'bitcoin', 'eth')"),
        vsCurrency: z
            .string()
            .default("usd")
            .describe("The target currency to get price in (e.g., 'usd', 'eur', 'jpy')"),
        includeMarketCap: z.boolean().optional().default(false).describe("Include market cap data in the response"),
        include24hrVol: z.boolean().optional().default(false).describe("Include 24 hour volume data in the response"),
        include24hrChange: z
            .boolean()
            .optional()
            .default(false)
            .describe("Include 24 hour price change data in the response"),
        includeLastUpdatedAt: z
            .boolean()
            .optional()
            .default(false)
            .describe("Include last updated timestamp in the response"),
    }),
) {}

export class SearchCoinsParameters extends createToolParameters(
    z.object({
        query: z.string().describe("The search query to find coins (e.g., 'bitcoin' or 'btc')"),
    }),
) {}

export class GetCoinPriceByContractAddressParameters extends createToolParameters(
    z.object({
        id: z.string().describe("Asset platform's id (e.g., 'eth')"),
        contractAddresses: z.array(z.string()).describe("List of contract addresses for the tokens"),
        vsCurrency: z.string().default("usd").describe("Target currency (e.g., 'usd', 'eur')"),
        includeMarketCap: z.boolean().optional().default(false).describe("Include market cap data"),
        include24hrVol: z.boolean().optional().default(false).describe("Include 24hr volume"),
        include24hrChange: z.boolean().optional().default(false).describe("Include 24hr change"),
        includeLastUpdatedAt: z.boolean().optional().default(false).describe("Include last updated timestamp"),
    }),
) {}

export class GetCoinDataParameters extends createToolParameters(
    z.object({
        id: z.string().describe("Pass the coin id (can be obtained from the supported coins endpoint)"),
        localization: z.boolean().optional().default(false).describe("Include all localizations"),
        tickers: z.boolean().optional().default(true).describe("Include tickers data"),
        marketData: z.boolean().optional().default(true).describe("Include market data"),
        communityData: z.boolean().optional().default(true).describe("Include community data"),
        developerData: z.boolean().optional().default(true).describe("Include developer data"),
        sparkline: z.boolean().optional().default(false).describe("Include sparkline 7 days data"),
    }),
) {}

export class GetHistoricalDataParameters extends createToolParameters(
    z.object({
        id: z.string().describe("Pass the coin id (can be obtained from the supported coins endpoint)"),
        date: z.string().describe("The date of data snapshot in dd-mm-yyyy format"),
        localization: z.boolean().optional().default(true).describe("Include localized languages"),
    }),
) {}

export class GetOHLCParameters extends createToolParameters(
    z.object({
        id: z.string().describe("Pass the coin id (can be obtained from the supported coins endpoint)"),
        vsCurrency: z.string().default("usd").describe("The target currency of market data (usd, eur, jpy, etc.)"),
        days: z.number().describe("Data up to number of days ago (1/7/14/30/90/180/365/max)"),
    }),
) {}

export class GetTrendingCoinCategoriesParameters extends createToolParameters(
    z.object({
        vsCurrency: z.string().default("usd").describe("The target currency of market data (usd, eur, jpy, etc.)"),
        ids: z.array(z.string()).describe("The ids of the coins to get trending data for"),
        category: z.string().describe("The category to get trending data for"),
        order: z
            .enum(["market_cap_desc", "volume_desc", "volume_asc", "market_cap_asc"])
            .describe("The order to get trending data for"),
        perPage: z.number().min(1).max(30).default(10).describe("The number of trending coins to get"),
        page: z.number().describe("The page number to get trending coins for"),
        sparkline: z.boolean().optional().default(false).describe("Include sparkline 7 days data"),
        priceChangePercentage: z
            .enum(["1h", "24h", "7d", "14d", "30d", "200d", "1y"])
            .optional()
            .default("24h")
            .describe("The price change percentage to get trending coins for"),
        locale: z.string().optional().default("en").describe("The locale to get trending coins for"),
    }),
) {}
