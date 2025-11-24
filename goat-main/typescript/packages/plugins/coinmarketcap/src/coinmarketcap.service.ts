import { Tool } from "@goat-sdk/core";

import {
    ContentLatestParameters,
    CryptocurrencyListingsParameters,
    CryptocurrencyMapParameters,
    CryptocurrencyOHLCVLatestParameters,
    CryptocurrencyQuotesLatestParameters,
    CryptocurrencyTrendingGainersLosersParameters,
    CryptocurrencyTrendingLatestParameters,
    CryptocurrencyTrendingMostVisitedParameters,
    ExchangeListingsParameters,
    ExchangeQuotesLatestParameters,
} from "./parameters";

import { CoinmarketcapApi } from "./api";

export class CoinmarketcapService {
    private readonly api: CoinmarketcapApi;

    constructor(apiKey: string) {
        this.api = new CoinmarketcapApi(apiKey);
    }

    @Tool({
        description:
            "Fetch the latest cryptocurrency listings with market data including price, market cap, volume, and other key metrics",
    })
    async getCryptocurrencyListings(parameters: CryptocurrencyListingsParameters) {
        try {
            return await this.api.makeRequest("/v1/cryptocurrency/listings/latest", {
                start: parameters.start,
                limit: parameters.limit,
                sort: parameters.sort,
                sort_dir: parameters.sort_dir,
                cryptocurrency_type: parameters.cryptocurrency_type,
                tag: parameters.tag,
                aux: parameters.aux?.join(","),
                convert: parameters.convert,
            });
        } catch (error) {
            throw new Error(`Failed to fetch cryptocurrency listings: ${error}`);
        }
    }

    @Tool({
        description:
            "Get the latest market quotes for one or more cryptocurrencies, including price, market cap, and volume in any supported currency",
    })
    async getCryptocurrencyQuotes(parameters: CryptocurrencyQuotesLatestParameters) {
        try {
            return await this.api.makeRequest("/v2/cryptocurrency/quotes/latest", {
                id: parameters.id?.join(","),
                symbol: parameters.symbol?.join(","),
                convert: parameters.convert,
                aux: parameters.aux?.join(","),
            });
        } catch (error) {
            throw new Error(`Failed to fetch cryptocurrency quotes: ${error}`);
        }
    }

    @Tool({
        description:
            "Fetch the latest cryptocurrency exchange listings with market data including trading volume, number of markets, and liquidity metrics",
    })
    async getExchangeListings(parameters: ExchangeListingsParameters) {
        try {
            return await this.api.makeRequest("/v1/exchange/listings/latest", {
                start: parameters.start,
                limit: parameters.limit,
                sort: parameters.sort,
                sort_dir: parameters.sort_dir,
                market_type: parameters.market_type,
                aux: parameters.aux?.join(","),
            });
        } catch (error) {
            throw new Error(`Failed to fetch exchange listings: ${error}`);
        }
    }

    @Tool({
        description:
            "Get the latest market data for one or more exchanges including trading volume, number of markets, and other exchange-specific metrics",
    })
    async getExchangeQuotes(parameters: ExchangeQuotesLatestParameters) {
        try {
            return await this.api.makeRequest("/v1/exchange/quotes/latest", {
                id: parameters.id?.join(","),
                slug: parameters.slug?.join(","),
                convert: parameters.convert,
                aux: parameters.aux?.join(","),
            });
        } catch (error) {
            throw new Error(`Failed to fetch exchange quotes: ${error}`);
        }
    }

    @Tool({
        description: "Fetch the latest cryptocurrency news, articles, and market analysis content from trusted sources",
    })
    async getContent(parameters: ContentLatestParameters) {
        try {
            return await this.api.makeRequest("/v1/content/latest", {
                start: parameters.start,
                limit: parameters.limit,
                id: parameters.id?.join(","),
                slug: parameters.slug?.join(","),
                symbol: parameters.symbol?.join(","),
                news_type: parameters.news_type,
                content_type: parameters.content_type,
                category: parameters.category,
                language: parameters.language,
            });
        } catch (error) {
            throw new Error(`Failed to fetch content: ${error}`);
        }
    }

    @Tool({
        description:
            "Get a mapping of all cryptocurrencies with unique CoinMarketCap IDs, including active and inactive assets",
    })
    async getCryptocurrencyMap(parameters: CryptocurrencyMapParameters) {
        try {
            return await this.api.makeRequest("/v1/cryptocurrency/map", {
                listing_status: parameters.listing_status,
                start: parameters.start,
                limit: parameters.limit,
                sort: parameters.sort,
                symbol: parameters.symbol?.join(","),
                aux: parameters.aux?.join(","),
            });
        } catch (error) {
            throw new Error(`Failed to fetch cryptocurrency map: ${error}`);
        }
    }

    @Tool({
        description: "Get the latest OHLCV (Open, High, Low, Close, Volume) values for cryptocurrencies",
    })
    async getCryptocurrencyOHLCV(parameters: CryptocurrencyOHLCVLatestParameters) {
        try {
            return await this.api.makeRequest("/v2/cryptocurrency/ohlcv/latest", {
                id: parameters.id?.join(","),
                symbol: parameters.symbol?.join(","),
                convert: parameters.convert,
                convert_id: parameters.convert_id,
                skip_invalid: parameters.skip_invalid,
            });
        } catch (error) {
            throw new Error(`Failed to fetch cryptocurrency OHLCV data: ${error}`);
        }
    }

    @Tool({
        description: "Get the latest trending cryptocurrencies based on CoinMarketCap user activity",
    })
    async getCryptocurrencyTrending(parameters: CryptocurrencyTrendingLatestParameters) {
        try {
            return await this.api.makeRequest("/cryptocurrency/trending/latest", {
                start: parameters.start,
                limit: parameters.limit,
                time_period: parameters.time_period,
                convert: parameters.convert,
                convert_id: parameters.convert_id,
            });
        } catch (error) {
            throw new Error(`Failed to fetch trending cryptocurrencies: ${error}`);
        }
    }

    @Tool({
        description: "Get the most visited cryptocurrencies on CoinMarketCap over a specified time period",
    })
    async getCryptocurrencyMostVisited(parameters: CryptocurrencyTrendingMostVisitedParameters) {
        try {
            return await this.api.makeRequest("/cryptocurrency/trending/most-visited", {
                start: parameters.start,
                limit: parameters.limit,
                time_period: parameters.time_period,
                convert: parameters.convert,
                convert_id: parameters.convert_id,
            });
        } catch (error) {
            throw new Error(`Failed to fetch most visited cryptocurrencies: ${error}`);
        }
    }

    @Tool({
        description:
            "Get the top gaining and losing cryptocurrencies based on price changes over different time periods",
    })
    async getCryptocurrencyGainersLosers(parameters: CryptocurrencyTrendingGainersLosersParameters) {
        try {
            return await this.api.makeRequest("/cryptocurrency/trending/gainers-losers", {
                start: parameters.start,
                limit: parameters.limit,
                time_period: parameters.time_period,
                convert: parameters.convert,
                convert_id: parameters.convert_id,
                sort: parameters.sort,
                sort_dir: parameters.sort_dir,
            });
        } catch (error) {
            throw new Error(`Failed to fetch cryptocurrency gainers and losers: ${error}`);
        }
    }
}
