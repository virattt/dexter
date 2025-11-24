export class BirdeyeApi {
    public readonly baseUrl = "https://public-api.birdeye.so";

    constructor(private readonly apiKey: string) {}

    async makeRequest(endpoint: string, chain = "solana", options: RequestInit = {}) {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            ...options,
            headers: {
                ...options.headers,
                "X-API-KEY": this.apiKey,
                "x-chain": chain,
            },
        });

        if (!response.ok) {
            if (response.status === 429) {
                throw new Error("BirdEye API rate limit exceeded");
            }
            throw new Error(`BirdEye API request failed: ${response.statusText}`);
        }

        return (await response.json()).data;
    }
}
