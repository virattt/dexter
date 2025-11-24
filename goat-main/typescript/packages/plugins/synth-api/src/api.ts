export class SynthAPI {
    public static readonly API_BASE_URL = "https://synth.mode.network";

    constructor(private readonly apiKey: string) {}

    public async request(
        endpoint: string,
        params: Record<string, string | boolean | number>,
        options: RequestInit = {},
    ) {
        const url = new URL(`${SynthAPI.API_BASE_URL}/${endpoint}?${this.buildSearchParams(params)}`);

        const response = await fetch(url.toString(), {
            ...options,
            headers: {
                ...options.headers,
                Authorization: `Apikey ${this.apiKey}`,
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
