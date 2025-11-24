interface TokenChain {
    contractAddress: string;
}

interface TokenChains {
    [chainId: number]: TokenChain;
}

export interface Token {
    decimals: number;
    symbol: string;
    name: string;
    chains: TokenChains;
}

const MODE_MAINNET_CHAIN_ID = 34443;
const MODE_TESTNET_CHAIN_ID = 919;
const BASE_MAINNET_CHAIN_ID = 8453;
const BASE_TESTNET_CHAIN_ID = 84532;
const OPTIMISM_MAINNET_CHAIN_ID = 10;
const OPTIMISM_TESTNET_CHAIN_ID = 11155420;

export const SUPPORTED_TOKENS: Record<string, Token> = {
    USDT: {
        decimals: 6,
        symbol: "USDT",
        name: "USDT",
        chains: {
            [MODE_MAINNET_CHAIN_ID]: {
                contractAddress: "0xf0f161fda2712db8b566946122a5af183995e2ed",
            },
        },
    },
    USDC: {
        decimals: 6,
        symbol: "USDC",
        name: "USDC",
        chains: {
            [MODE_MAINNET_CHAIN_ID]: {
                contractAddress: "0xd988097fb8612cc24eeC14542bC03424c656005f",
            },
            [MODE_TESTNET_CHAIN_ID]: {
                contractAddress: "0x9C5b4fe1d8A676fF14e07dbF61c99Cabfec21119",
            },
            [BASE_TESTNET_CHAIN_ID]: {
                contractAddress: "0xfE8Ae0606Bd37DA4ab2886F7824ab82A2d0Ef582",
            },
            [OPTIMISM_TESTNET_CHAIN_ID]: {
                contractAddress: "0x2bC5313c164F7FafDa7629fb7942226fd3921904",
            },
        },
    },
    MODE: {
        decimals: 18,
        symbol: "MODE",
        name: "Mode",
        chains: {
            [MODE_MAINNET_CHAIN_ID]: {
                contractAddress: "0xDfc7C877a950e49D2610114102175A06C2e3167a",
            },
            [MODE_TESTNET_CHAIN_ID]: {
                contractAddress: "0x4FFa6cDEB4deF980b75e3F4764797A2CAd1fAEF3",
            },
        },
    },
    WETH: {
        decimals: 18,
        symbol: "WETH",
        name: "Wrapped Ether",
        chains: {
            [MODE_MAINNET_CHAIN_ID]: {
                contractAddress: "0x4200000000000000000000000000000000000006",
            },
            [MODE_TESTNET_CHAIN_ID]: {
                contractAddress: "0x4200000000000000000000000000000000000006",
            },
        },
    },
    MOCHAD: {
        decimals: 18,
        symbol: "MOCHAD",
        name: "Mochad",
        chains: {
            [MODE_MAINNET_CHAIN_ID]: {
                contractAddress: "0xcDa802a5BFFaa02b842651266969A5Bba0c66D3e",
            },
        },
    },
    EZETH: {
        decimals: 18,
        symbol: "EZETH",
        name: "ezETH",
        chains: {
            [MODE_MAINNET_CHAIN_ID]: {
                contractAddress: "0x2416092f143378750bb29b79ed961ab195cceea5",
            },
        },
    },
    WBTC: {
        decimals: 8,
        symbol: "WBTC",
        name: "Wrapped Bitcoin",
        chains: {
            [MODE_MAINNET_CHAIN_ID]: {
                contractAddress: "0xcDd475325D6F564d27247D1DddBb0DAc6fA0a5CF",
            },
        },
    },
    UNI: {
        decimals: 18,
        symbol: "UNI",
        name: "Uniswap",
        chains: {
            [MODE_MAINNET_CHAIN_ID]: {
                contractAddress: "0x3e7eF8f50246f725885102E8238CBba33F276747",
            },
        },
    },
    SNX: {
        decimals: 18,
        symbol: "SNX",
        name: "Synthetix",
        chains: {
            [MODE_MAINNET_CHAIN_ID]: {
                contractAddress: "0x9e5AAC1Ba1a2e6aEd6b32689DFcF62A509Ca96f3",
            },
        },
    },
    LINK: {
        decimals: 18,
        symbol: "LINK",
        name: "Chainlink",
        chains: {
            [MODE_MAINNET_CHAIN_ID]: {
                contractAddress: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
            },
        },
    },
    DAI: {
        decimals: 18,
        symbol: "DAI",
        name: "Dai Stablecoin",
        chains: {
            [MODE_MAINNET_CHAIN_ID]: {
                contractAddress: "0xE7798f023fC62146e8Aa1b36Da45fb70855a77Ea",
            },
        },
    },
    BAL: {
        decimals: 18,
        symbol: "BAL",
        name: "Balancer",
        chains: {
            [MODE_MAINNET_CHAIN_ID]: {
                contractAddress: "0xD08a2917653d4E460893203471f0000826fb4034",
            },
        },
    },
    AAVE: {
        decimals: 18,
        symbol: "AAVE",
        name: "Aave",
        chains: {
            [MODE_MAINNET_CHAIN_ID]: {
                contractAddress: "0x7c6b91D9Be155A6Db01f749217d76fF02A7227F2",
            },
        },
    },
    DEGEN: {
        decimals: 18,
        symbol: "DEGEN",
        name: "Degen",
        chains: {
            [BASE_MAINNET_CHAIN_ID]: {
                contractAddress: "0x4ed4e862860bed51a9570b96d89af5e1b0efefed",
            },
        },
    },
    OP: {
        decimals: 18,
        symbol: "OP",
        name: "Optimism",
        chains: {
            [OPTIMISM_MAINNET_CHAIN_ID]: {
                contractAddress: "0x4200000000000000000000000000000000000042",
            },
        },
    },
} as const;
