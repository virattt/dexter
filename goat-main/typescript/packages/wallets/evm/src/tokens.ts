import { Token as CoreToken } from "@goat-sdk/core";
import { arbitrum, base, mainnet, mode, optimism, polygon, sepolia } from "viem/chains";

// Token definition
export type Token = CoreToken & {
    chains: {
        [chainId: number]: {
            contractAddress: `0x${string}`;
        };
    };
};

// Definitions based on the deleted erc20/token.ts file

export const PEPE: Token = {
    decimals: 18,
    symbol: "PEPE",
    name: "Pepe",
    chains: {
        [mainnet.id]: {
            contractAddress: "0x6982508145454Ce325dDbE47a25d4ec3d2311933",
        },
        [optimism.id]: {
            contractAddress: "0xc1c167cc44f7923cd0062c4370df962f9ddb16f5",
        },
        [base.id]: {
            contractAddress: "0xb4fde59a779991bfb6a52253b51947828b982be3",
        },
    },
};

export const USDC: Token = {
    decimals: 6,
    symbol: "USDC",
    name: "USD Coin", // Corrected name
    chains: {
        [mainnet.id]: {
            contractAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        },
        [optimism.id]: {
            contractAddress: "0x0b2c639c533813f4aa9d7837caf62653d097ff85",
        },
        [polygon.id]: {
            contractAddress: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
        },
        [base.id]: {
            contractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        },
        // Note: baseSepolia ID is 84532, not explicitly imported by default
        84532: {
            contractAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        },
        [sepolia.id]: {
            contractAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
        },
        [mode.id]: {
            // Mode mainnet ID
            contractAddress: "0xd988097fb8612cc24eeC14542bC03424c656005f",
        },
    },
};

export const MODE: Token = {
    decimals: 18,
    symbol: "MODE",
    name: "Mode",
    chains: {
        [mode.id]: {
            // Mode mainnet ID
            contractAddress: "0xDfc7C877a950e49D2610114102175A06C2e3167a",
        },
    },
};

export const WETH: Token = {
    decimals: 18,
    symbol: "WETH",
    name: "Wrapped Ether",
    chains: {
        [mainnet.id]: {
            contractAddress: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        },
        [base.id]: {
            contractAddress: "0x4200000000000000000000000000000000000006",
        },
        [mode.id]: {
            // Mode mainnet ID
            contractAddress: "0x4200000000000000000000000000000000000006",
        },
        [arbitrum.id]: {
            contractAddress: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
        },
        [optimism.id]: {
            contractAddress: "0x4200000000000000000000000000000000000006",
        },
        [polygon.id]: {
            // Note: The address listed 0x7ce... is typically Polygon PoS WETH, confirming this.
            contractAddress: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
        },
    },
};

// Combine all predefined tokens into one array for easy import/use
export const PREDEFINED_TOKENS: Token[] = [
    PEPE,
    USDC,
    MODE,
    WETH,
    // Add any other tokens that might have been missed or need defining
];
