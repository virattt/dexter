import { Tool } from "@goat-sdk/core";
import {
    GetNFTDetailsParams,
    GetNFTTradesParams,
    GetSmartMoneyParams,
    GetTokenDetailsParams,
    GetTokenTradesParams,
    GetTradingSignalParams,
} from "./parameters";

export class NansenService {
    constructor(private readonly apiKey: string) {}

    private async fetchNansen(endpoint: string) {
        const response = await fetch(`https://api.nansen.ai/v1${endpoint}`, {
            headers: {
                accept: "application/json",
                "api-key": this.apiKey,
            },
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    }

    @Tool({
        name: "nansen_get_token_details",
        description: "Get details for a specific token from Nansen",
    })
    async getTokenDetails(parameters: GetTokenDetailsParams) {
        const { address } = parameters;
        return this.fetchNansen(`/token?address=${address}`);
    }

    @Tool({
        name: "nansen_get_token_trades",
        description: "Get trades for a specific token from Nansen",
    })
    async getTokenTrades(parameters: GetTokenTradesParams) {
        const { address, start_date, end_date } = parameters;
        const queryParams = `?address=${address}&start_date=${start_date}&end_date=${end_date}`;
        return this.fetchNansen(`/token/dex_trades${queryParams}`);
    }

    @Tool({
        name: "nansen_get_nft_details",
        description: "Get details for a specific NFT collection or token from Nansen",
    })
    async getNFTDetails(parameters: GetNFTDetailsParams) {
        const { token_address, nft_id } = parameters;
        const queryParams = `?token_address=${token_address}&nft_id=${nft_id}`;
        return this.fetchNansen(`/nft${queryParams}`);
    }

    @Tool({
        name: "nansen_get_nft_trades",
        description: "Get trades for a specific NFT collection or token from Nansen",
    })
    async getNFTTrades(parameters: GetNFTTradesParams) {
        const { token_address, nft_id, start_date, end_date } = parameters;
        const queryParams = `?token_address=${token_address}&nft_id=${nft_id}&start_date=${start_date}&end_date=${end_date}`;
        return this.fetchNansen(`/nft/trades${queryParams}`);
    }

    @Tool({
        description: "Get the flows of tokens associated with smart money addresses",
    })
    async getSmartMoneyStatus(parameters: GetSmartMoneyParams) {
        const { start_date, end_date, token_address } = parameters;
        const queryParams = `?start_date=${start_date}&end_date=${end_date}`;
        const tokenParam = token_address ? `&token_address=${token_address}` : "";
        return this.fetchNansen(`/token_flows${queryParams}${tokenParam}`);
    }

    @Tool({
        name: "nansen_get_trading_signal",
        description: "Get trading signals and alerts based on onchain data and patterns",
    })
    async getTradingSignal(parameters: GetTradingSignalParams) {
        const { start_date, end_date, token_address } = parameters;
        const queryParams = `?start_date=${start_date}&end_date=${end_date}`;
        const tokenParam = token_address ? `&token_address=${token_address}` : "";
        return this.fetchNansen(`/signals${queryParams}${tokenParam}`);
    }
}
