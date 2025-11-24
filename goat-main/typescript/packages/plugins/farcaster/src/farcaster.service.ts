import { Tool } from "@goat-sdk/core";
import {
    GetCastParameters,
    GetConversationParameters,
    PublishCastParameters,
    SearchCastsParameters,
} from "./parameters";
import { FarcasterConfig } from "./types";

export class FarcasterClient {
    private apiKey: string;
    private baseUrl: string;

    constructor(config: FarcasterConfig) {
        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl || "https://api.neynar.com/v2/farcaster";
    }

    @Tool({
        description: "Get a cast by its URL or hash",
    })
    async getCast(params: GetCastParameters) {
        return this.makeRequest(`/cast?identifier=${params.identifier}&type=${params.type}`);
    }

    @Tool({
        description: "Publish a new cast",
    })
    async publishCast(params: PublishCastParameters) {
        return this.makeRequest("/cast", {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({
                signer_uuid: params.signer_uuid,
                text: params.text,
                parent: params.parent,
                channel_id: params.channel_id,
            }),
        });
    }

    @Tool({
        description: "Search for casts",
    })
    async searchCasts(params: SearchCastsParameters) {
        const searchParams = new URLSearchParams({
            q: params.query,
            ...Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)])),
        });
        return this.makeRequest(`/cast/search?${searchParams}`);
    }

    @Tool({
        description: "Get a conversation by its URL or hash",
    })
    async getConversation(params: GetConversationParameters) {
        const searchParams = new URLSearchParams({
            identifier: params.identifier,
            type: params.type || "hash",
            reply_depth: String(params.reply_depth || 2),
            limit: String(params.limit || 20),
        });
        return this.makeRequest(`/cast/conversation?${searchParams}`);
    }

    private async makeRequest(endpoint: string, options: RequestInit = {}) {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            ...options,
            headers: {
                accept: "application/json",
                "x-api-key": this.apiKey,
                ...options.headers,
            },
        });

        if (!response.ok) {
            throw new Error(`Farcaster API error: ${response.statusText}`);
        }

        return response.json();
    }
}
