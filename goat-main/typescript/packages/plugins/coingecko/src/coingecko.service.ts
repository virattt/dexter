import { Tool } from "@goat-sdk/core";
import { CoinGeckoAPI } from "./api";
import {
    GetCoinDataParameters,
    GetCoinPriceByContractAddressParameters,
    GetCoinPricesParameters,
    GetHistoricalDataParameters,
    GetOHLCParameters,
    GetTrendingCoinCategoriesParameters,
    NoParams,
    SearchCoinsParameters,
} from "./parameters";

export class CoinGeckoService {
    constructor(protected api: CoinGeckoAPI) {}

    @Tool({
        name: "coingecko_get_trending_coins",
        description: "Get the list of trending coins from CoinGecko",
    })
    async getTrendingCoins(parameters: NoParams) {
        return this.api.request("search/trending", {});
    }

    @Tool({
        name: "coingecko_get_coin_prices",
        description: "Get the prices of specific coins from CoinGecko",
    })
    async getCoinPrices(parameters: GetCoinPricesParameters) {
        const { coinIds, vsCurrency, includeMarketCap, include24hrVol, include24hrChange, includeLastUpdatedAt } =
            parameters;
        return this.api.request("simple/price", {
            ids: coinIds.join(","),
            vs_currencies: vsCurrency,
            include_market_cap: includeMarketCap,
            include_24hr_vol: include24hrVol,
            include_24hr_change: include24hrChange,
            include_last_updated_at: includeLastUpdatedAt,
        });
    }

    @Tool({
        name: "coingecko_search_coins",
        description: "Search for coins by keyword",
    })
    async searchCoins(parameters: SearchCoinsParameters) {
        const { query } = parameters;
        return this.api.request("search", {
            query,
        });
    }

    @Tool({
        name: "coingecko_get_coin_price_by_contract_address",
        description: "Get coin price by contract address",
    })
    async getCoinPriceByContractAddress(parameters: GetCoinPriceByContractAddressParameters) {
        const {
            id,
            contractAddresses,
            vsCurrency,
            includeMarketCap,
            include24hrVol,
            include24hrChange,
            includeLastUpdatedAt,
        } = parameters;

        return this.api.request(`simple/token_price/${id}`, {
            contract_addresses: contractAddresses.join(","),
            vs_currencies: vsCurrency,
            include_market_cap: includeMarketCap,
            include_24hr_vol: include24hrVol,
            include_24hr_change: include24hrChange,
            include_last_updated_at: includeLastUpdatedAt,
        });
    }

    @Tool({
        name: "coingecko_get_coin_data",
        description:
            "Get detailed coin data by ID (including contract address, market data, community data, developer stats, and more)",
    })
    async getCoinData(parameters: GetCoinDataParameters) {
        const { id, localization, tickers, marketData, communityData, developerData, sparkline } = parameters;

        return this.api.request(`coins/${id}`, {
            localization,
            tickers,
            market_data: marketData,
            community_data: communityData,
            developer_data: developerData,
            sparkline,
        });
    }

    @Tool({
        name: "coingecko_get_historical_data",
        description: "Get historical data for a coin by ID",
    })
    async getHistoricalData(parameters: GetHistoricalDataParameters) {
        const { id, date, localization } = parameters;
        return this.api.request(`coins/${id}/history`, {
            date,
            localization,
        });
    }

    @Tool({
        name: "coingecko_get_ohlc_data",
        description: "Get OHLC chart data for a coin by ID",
    })
    async getOHLCData(parameters: GetOHLCParameters) {
        const { id, vsCurrency, days } = parameters;
        return this.api.request(`coins/${id}/ohlc`, {
            vs_currency: vsCurrency,
            days,
        });
    }

    @Tool({
        name: "coingecko_get_trending_coin_categories",
        description: "Get trending coin categories",
    })
    async getTrendingCoinCategories(parameters: GetTrendingCoinCategoriesParameters) {
        const { vsCurrency, ids, category, order, perPage, page, sparkline, priceChangePercentage, locale } =
            parameters;
        return this.api.request("coins/markets", {
            vs_currency: vsCurrency,
            ids: ids.join(","),
            category,
            order,
            per_page: perPage,
            page,
            sparkline,
            price_change_percentage: priceChangePercentage,
            locale,
        });
    }

    @Tool({
        name: "coingecko_get_coin_categories",
        description: "Get all coin categories",
    })
    async coinCategories(parameters: NoParams) {
        return this.api.request("coins/categories", {});
    }
}
