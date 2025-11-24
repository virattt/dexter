import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

export class CryptocurrencyListingsParameters extends createToolParameters(
    z.object({
        start: z.number().optional().describe("Starting position of results"),
        limit: z.number().optional().describe("Number of results to return"),
        sort: z
            .enum([
                "market_cap",
                "name",
                "symbol",
                "date_added",
                "market_cap_strict",
                "price",
                "circulating_supply",
                "total_supply",
                "max_supply",
                "num_market_pairs",
                "volume_24h",
                "percent_change_1h",
                "percent_change_24h",
                "percent_change_7d",
                "market_cap_by_total_supply_strict",
                "volume_7d",
                "volume_30d",
            ])
            .optional()
            .default("market_cap")
            .describe("What field to sort the list by"),
        sort_dir: z.enum(["asc", "desc"]).optional().describe("Direction to sort the list"),
        cryptocurrency_type: z
            .enum(["all", "coins", "tokens"])
            .optional()
            .describe("Type of cryptocurrency to include"),
        tag: z.string().optional().describe("Tag to filter by"),
        aux: z
            .array(
                z.enum([
                    "num_market_pairs",
                    "cmc_rank",
                    "date_added",
                    "tags",
                    "platform",
                    "max_supply",
                    "circulating_supply",
                    "total_supply",
                    "market_cap_by_total_supply",
                    "volume_24h_reported",
                    "volume_7d",
                    "volume_7d_reported",
                    "volume_30d",
                    "volume_30d_reported",
                    "is_market_cap_included_in_calc",
                ]),
            )
            .optional()
            .describe("Array of auxiliary fields to return"),
        convert: z.string().optional().describe("Currency to convert prices to"),
    }),
) {}

export class CryptocurrencyQuotesLatestParameters extends createToolParameters(
    z.object({
        id: z.array(z.string()).optional().describe("One or more cryptocurrency IDs"),
        symbol: z.array(z.string()).optional().describe("One or more cryptocurrency symbols"),
        convert: z.string().optional().describe("Currency to convert prices to"),
        aux: z
            .array(
                z.enum([
                    "num_market_pairs",
                    "cmc_rank",
                    "date_added",
                    "tags",
                    "platform",
                    "max_supply",
                    "circulating_supply",
                    "total_supply",
                    "market_cap_by_total_supply",
                    "volume_24h_reported",
                    "volume_7d",
                    "volume_7d_reported",
                    "volume_30d",
                    "volume_30d_reported",
                    "is_active",
                    "is_fiat",
                ]),
            )
            .optional()
            .describe("Array of auxiliary fields to return"),
    }),
) {}

export class ExchangeListingsParameters extends createToolParameters(
    z.object({
        start: z.number().optional().describe("Starting position of results"),
        limit: z.number().optional().describe("Number of results to return"),
        sort: z
            .enum(["name", "volume_24h", "volume_24h_adjusted", "exchange_score"])
            .optional()
            .describe("What field to sort the list by"),
        sort_dir: z.enum(["asc", "desc"]).optional().describe("Direction to sort the list"),
        market_type: z.enum(["all", "spot", "derivatives"]).optional().describe("Type of exchange market"),
        aux: z
            .array(
                z.enum([
                    "num_market_pairs",
                    "traffic_score",
                    "rank",
                    "exchange_score",
                    "effective_liquidity_24h",
                    "date_launched",
                    "fiats",
                ]),
            )
            .optional()
            .describe("Array of auxiliary fields to return"),
        convert: z.string().optional().describe("Currency to convert prices to"),
    }),
) {}

export class ExchangeQuotesLatestParameters extends createToolParameters(
    z.object({
        id: z.array(z.string()).optional().describe("One or more exchange IDs"),
        slug: z.array(z.string()).optional().describe("One or more exchange slugs"),
        convert: z.string().optional().describe("Currency to convert prices to"),
        aux: z
            .array(
                z.enum([
                    "num_market_pairs",
                    "traffic_score",
                    "rank",
                    "exchange_score",
                    "liquidity_score",
                    "effective_liquidity_24h",
                ]),
            )
            .optional()
            .describe("Array of auxiliary fields to return"),
    }),
) {}

export class ContentLatestParameters extends createToolParameters(
    z.object({
        start: z.number().optional().describe("Starting position of results"),
        limit: z.number().optional().describe("Number of results to return"),
        id: z.array(z.string()).optional().describe("One or more cryptocurrency IDs"),
        slug: z.array(z.string()).optional().describe("One or more cryptocurrency slugs, e.g bitcoin, ethereum, etc."),
        symbol: z.array(z.string()).optional().describe("One or more cryptocurrency symbols e.g BTC, ETH, etc."),
        news_type: z.enum(["news", "community", "alexandria"]).optional().describe("Type of news content to return"),
        content_type: z
            .enum(["all", "news", "video", "audio"])
            .optional()
            .describe("Type of content category to return"),
        category: z.string().optional().describe("Category of content to return Example: GameFi, DeFi, etc."),
        language: z
            .enum([
                "en",
                "zh",
                "zh-tw",
                "de",
                "id",
                "ja",
                "ko",
                "es",
                "th",
                "tr",
                "vi",
                "ru",
                "fr",
                "nl",
                "ar",
                "pt-br",
                "hi",
                "pl",
                "uk",
                "fil-rph",
                "it",
            ])
            .optional()
            .describe("Language of content to return"),
    }),
) {}

export class CryptocurrencyMapParameters extends createToolParameters(
    z.object({
        listing_status: z.enum(["active", "inactive", "untracked"]).optional().describe("Status of listings to return"),
        start: z.number().optional().describe("Starting position of results"),
        limit: z.number().optional().describe("Number of results to return"),
        sort: z.enum(["cmc_rank", "id", "name"]).optional().describe("What field to sort the list by"),
        symbol: z.array(z.string()).optional().describe("Cryptocurrency symbol(s) to filter by"),
        aux: z
            .array(z.enum(["platform", "first_historical_data", "last_historical_data", "is_active", "status"]))
            .optional()
            .describe("Array of auxiliary fields to return"),
    }),
) {}

export class CryptocurrencyOHLCVLatestParameters extends createToolParameters(
    z.object({
        id: z.array(z.string()).optional().describe("One or more cryptocurrency IDs"),
        symbol: z.array(z.string()).optional().describe("One or more cryptocurrency symbols"),
        convert: z.string().optional().describe("Currency to convert prices to"),
        convert_id: z.string().optional().describe("Currency ID to convert prices to"),
        skip_invalid: z.boolean().optional().describe("Skip invalid currency conversions"),
    }),
) {}

export class CryptocurrencyTrendingLatestParameters extends createToolParameters(
    z.object({
        start: z.number().optional().describe("Starting position of results"),
        limit: z.number().optional().describe("Number of results to return"),
        time_period: z.enum(["24h", "30d", "7d"]).optional().describe("Time period for trending data"),
        convert: z.string().optional().describe("Currency to convert prices to"),
        convert_id: z.string().optional().describe("Currency ID to convert prices to"),
    }),
) {}

export class CryptocurrencyTrendingMostVisitedParameters extends createToolParameters(
    z.object({
        start: z.number().optional().describe("Starting position of results"),
        limit: z.number().optional().describe("Number of results to return"),
        time_period: z.enum(["24h", "30d", "7d"]).optional().describe("Time period for trending data"),
        convert: z.string().optional().describe("Currency to convert prices to"),
        convert_id: z.string().optional().describe("Currency ID to convert prices to"),
    }),
) {}

export class CryptocurrencyTrendingGainersLosersParameters extends createToolParameters(
    z.object({
        start: z.number().optional().describe("Starting position of results"),
        limit: z.number().optional().describe("Number of results to return"),
        time_period: z.enum(["1h", "24h", "7d", "30d"]).optional().describe("Time period for trending data"),
        convert: z.string().optional().describe("Currency to convert prices to"),
        convert_id: z.string().optional().describe("Currency ID to convert prices to"),
        sort: z.enum(["percent_change_24h"]).optional().describe("What field to sort the list by"),
        sort_dir: z.enum(["asc", "desc"]).optional().describe("Direction to sort the list"),
    }),
) {}
