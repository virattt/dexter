import type { Token as CoreToken } from "@goat-sdk/core";

export type SolanaNetwork = "devnet" | "mainnet";

export type Token = CoreToken & {
    mintAddress: string | null; // Adjusted for direct use in wallet
};

// Original Token structure from plugin (might still be useful elsewhere)
// export type TokenConfig = {
//     decimals: number;
//     symbol: string;
//     name: string;
//     mintAddresses: Record<SolanaNetwork, string | null>;
// };

// Adjusted Predefined Tokens (network specific)
export const SPL_TOKENS: Record<SolanaNetwork, Token[]> = {
    mainnet: [
        {
            decimals: 6,
            symbol: "USDC",
            name: "USD Coin",
            mintAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        },
        {
            decimals: 6,
            symbol: "GOAT",
            name: "GOAT",
            mintAddress: "CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump",
        },
        {
            decimals: 6,
            symbol: "PENGU",
            name: "Pengu",
            mintAddress: "2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv",
        },
        {
            decimals: 9,
            symbol: "WSOL", // Changed symbol to WSOL for clarity
            name: "Wrapped SOL",
            mintAddress: "So11111111111111111111111111111111111111112",
        },
    ],
    devnet: [
        {
            decimals: 6,
            symbol: "USDC",
            name: "USD Coin",
            mintAddress: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
        },
        {
            decimals: 9,
            symbol: "WSOL", // Changed symbol to WSOL for clarity
            name: "Wrapped SOL",
            mintAddress: "So11111111111111111111111111111111111111112",
        },
        // Add other devnet tokens if needed
    ],
};
