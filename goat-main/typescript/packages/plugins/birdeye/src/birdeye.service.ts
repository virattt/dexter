import { Tool } from "@goat-sdk/core";
import { BirdeyeApi } from "./api";
import {
    GetOhlcvPairParameters,
    GetOhlcvParameters,
    GetTokenHistoryPriceParameters,
    GetTokenPriceParameters,
    GetTokenSecurityParameters,
    GetTrendingTokensParameters,
    SearchTokenParameters,
} from "./parameters";

export class BirdeyeDefiService {
    constructor(private readonly birdeyeApi: BirdeyeApi) {}

    @Tool({
        name: "birdeye_get_token_price",
        description: "Get price information for a token or multiple tokens (max 100)",
    })
    async getTokenPrice(params: GetTokenPriceParameters) {
        const endpoint = `/defi/multi_price?&addresses=${params.list_address.join(
            ",",
        )}${params.include_liquidity ? "&include_liquidity=true" : ""}`;
        const response = await this.birdeyeApi.makeRequest(endpoint, params.chain);
        return response;
    }

    @Tool({
        name: "birdeye_get_token_history_price",
        description: "Get historical price line chart for a token",
    })
    async getTokenHistoryPrice(params: GetTokenHistoryPriceParameters) {
        // except chain, transform all params in query string
        const queryString = Object.entries(params)
            .filter(([_, value]) => value !== undefined)
            .filter(([key]) => key !== "chain")
            .map(([key, value]) => `${key}=${value}`)
            .join("&");

        const endpoint = `/defi/history_price?${queryString}`;
        const response = await this.birdeyeApi.makeRequest(endpoint, params.chain);
        return response;
    }

    @Tool({
        name: "birdeye_get_ohlcv",
        description: "Get OHLCV price of token",
    })
    async getOhlcv(params: GetOhlcvParameters) {
        const queryString = Object.entries(params)
            .filter(([_, value]) => value !== undefined)
            .filter(([key]) => key !== "chain")
            .map(([key, value]) => `${key}=${value}`)
            .join("&");

        const endpoint = `/defi/ohlcv?${queryString}`;
        const response = await this.birdeyeApi.makeRequest(endpoint, params.chain);
        return response;
    }

    @Tool({
        name: "birdeye_get_ohlcv_pair",
        description: "Get OHLCV price of pair",
    })
    async getOhlcvPair(params: GetOhlcvPairParameters) {
        const queryString = Object.entries(params)
            .filter(([_, value]) => value !== undefined)
            .filter(([key]) => key !== "chain")
            .map(([key, value]) => `${key}=${value}`)
            .join("&");
        const endpoint = `/defi/ohlcv/pair?${queryString}`;
        const response = await this.birdeyeApi.makeRequest(endpoint);
        return response;
    }

    @Tool({
        name: "birdeye_get_token_security",
        description: "Get security information of a token",
    })
    async getTokenSecurity(params: GetTokenSecurityParameters) {
        const endpoint = `/defi/token_security?address=${params.address}`;
        const response = await this.birdeyeApi.makeRequest(endpoint, params.chain);
        return response;
    }

    @Tool({
        name: "birdeye_get_trending_tokens",
        description: "Get trending tokens",
    })
    async getTrendingTokens(params: GetTrendingTokensParameters) {
        const queryString = Object.entries(params)
            .filter(([_, value]) => value !== undefined)
            .filter(([key]) => key !== "chain")
            .map(([key, value]) => `${key}=${value}`)
            .join("&");
        const endpoint = `/defi/trending_tokens?${queryString}`;
        const response = await this.birdeyeApi.makeRequest(endpoint, params.chain);
        return response;
    }

    @Tool({
        name: "birdeye_search_token",
        description: "Search for a token",
    })
    async searchToken(params: SearchTokenParameters) {
        const queryString = Object.entries(params)
            .filter(([_, value]) => value !== undefined)
            .map(([key, value]) => `${key}=${value}`)
            .join("&");
        const endpoint = `/defi/v3/search?${queryString}`;
        const response = await this.birdeyeApi.makeRequest(endpoint, params.chain);
        return response;
    }
}
