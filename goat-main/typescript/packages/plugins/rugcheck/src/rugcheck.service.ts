import { Tool } from "@goat-sdk/core";
import { RugCheckApi } from "./api";
import { GetTokenReportParameters, NoParameters } from "./parameters";

export class RugCheckService {
    constructor(private readonly api: RugCheckApi) {}

    @Tool({
        name: "rugcheck_get_recently_detected_tokens",
        description: "Get recently detected tokens from RugCheck",
    })
    async getRecentlyDetectedTokens(params: NoParameters) {
        const endpoint = "/stats/new_tokens";
        return this.api.makeRequest(endpoint);
    }

    @Tool({
        name: "rugcheck_get_trending_tokens_24h",
        description: "Get trending tokens in the last 24h from RugCheck",
    })
    async getTrendingTokens24h(params: NoParameters) {
        const endpoint = "/stats/trending";
        return this.api.makeRequest(endpoint);
    }

    @Tool({
        name: "rugcheck_get_most_voted_tokens_24h",
        description: "Get tokens with the most votes in the last 24h from RugCheck",
    })
    async getMostVotedTokens24h(params: NoParameters) {
        const endpoint = "/stats/recent";
        return this.api.makeRequest(endpoint);
    }

    @Tool({
        name: "rugcheck_get_recently_verified_tokens",
        description: "Get recently verified tokens from RugCheck",
    })
    async getRecentlyVerifiedTokens(params: NoParameters) {
        const endpoint = "/stats/verified";
        return this.api.makeRequest(endpoint);
    }

    @Tool({
        name: "rugcheck_generate_token_report_summary",
        description: "Generate a report summary for the given token mint",
    })
    async generateTokenReportSummary(params: GetTokenReportParameters) {
        return this.api.makeRequest(`/tokens/${params.mint}/report/summary`);
    }
}
