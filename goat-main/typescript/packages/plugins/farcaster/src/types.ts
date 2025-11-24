export type Cast = {
    hash: string;
    author: {
        fid: number;
        username: string;
        displayName: string;
    };
    text: string;
    timestamp: number;
    replies: {
        count: number;
    };
};

export type FarcasterConfig = {
    apiKey: string;
    baseUrl?: string;
};
