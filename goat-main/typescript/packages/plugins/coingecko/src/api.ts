export class CoinGeckoAPI {
    public static readonly API_BASE_URL = "https://api.coingecko.com/api/v3";
    public static readonly PRO_API_BASE_URL = "https://pro-api.coingecko.com/api/v3";

    constructor(
        private readonly apiKey: string,
        private readonly isPro: boolean,
    ) {}

    public async request(
        endpoint: string,
        params: Record<string, string | boolean | number>,
        options: RequestInit = {},
    ) {
        const url = new URL(
            `${
                this.isPro ? CoinGeckoAPI.PRO_API_BASE_URL : CoinGeckoAPI.API_BASE_URL
            }/${endpoint}?${this.buildSearchParams(params)}`,
        );

        const response = await fetch(url.toString(), {
            ...options,
            headers: {
                ...options.headers,
                [this.isPro ? "x-cg-pro-api-key" : "x-cg-demo-api-key"]: this.apiKey,
            },
        });

        if (!response.ok) {
            throw new Error(
                `HTTP error! status: ${response.status}. URL: ${url.toString()}. Response: ${await response.text()}`,
            );
        }

        return response.json();
    }

    private buildSearchParams(params: Record<string, string | boolean | number>) {
        const searchParams = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined) {
                searchParams.append(key, value.toString());
            }
        }

        return searchParams.toString();
    }
}
