import { Tool } from "@goat-sdk/core";
import { CoinGeckoService } from "./coingecko.service";
import {
    GetPoolDataByPoolAddressParameters,
    GetTokenDataByTokenAddressParameters,
    GetTokensInfoByPoolAddressParameters,
    GetTrendingPoolsByNetworkParameters,
    GetTrendingPoolsParameters,
    TopGainersLosersParameters,
} from "./pro.parameters";

export class CoinGeckoProService extends CoinGeckoService {
    @Tool({
        name: "coingecko_get_pool_data_by_pool_address",
        description: "Get data for a specific pool by its address",
    })
    async getPoolDataByPoolAddress(parameters: GetPoolDataByPoolAddressParameters) {
        const { network, addresses } = parameters;
        return this.api.request(`coins/${network}/pools/multi/${addresses.join(",")}`, {});
    }

    @Tool({
        name: "coingecko_get_trending_pools",
        description: "Get trending pools for a specific network",
    })
    async getTrendingPools(parameters: GetTrendingPoolsParameters) {
        const { include, page, duration } = parameters;
        return this.api.request("onchain/networks/trending_pools", {
            include: include.join(","),
            page,
            duration,
        });
    }

    @Tool({
        name: "coingecko_get_trending_pools_by_network",
        description: "Get trending pools for a specific network",
    })
    async getTrendingPoolsByNetwork(parameters: GetTrendingPoolsByNetworkParameters) {
        const { network } = parameters;
        return this.api.request(`onchain/networks/${network}/trending_pools`, {});
    }

    @Tool({
        name: "coingecko_get_top_gainers_losers",
        description: "Get top gainers and losers for a specific duration",
    })
    async getTopGainersLosers(parameters: TopGainersLosersParameters) {
        const { vsCurrency, duration, topCoins } = parameters;
        return this.api.request("coins/top_gainers_losers", {
            vs_currency: vsCurrency,
            duration,
            top_coins: topCoins,
        });
    }

    @Tool({
        name: "coingecko_get_token_data_by_token_address",
        description: "Get data for a specific token by its address",
    })
    async getTokenDataByTokenAddress(parameters: GetTokenDataByTokenAddressParameters) {
        const { network, address } = parameters;
        return this.api.request(`onchain/networks/${network}/tokens/${address}/info`, {});
    }

    @Tool({
        name: "coingecko_get_tokens_info_by_pool_address",
        description: "Get data for all tokens in a specific pool by its address",
    })
    async getTokensInfoByPoolAddress(parameters: GetTokensInfoByPoolAddressParameters) {
        const { network, poolAddress } = parameters;
        return this.api.request(`onchain/networks/${network}/pools/${poolAddress}/tokens`, {});
    }
}
