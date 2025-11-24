/**
 * @param type - "evm" or "solana", extend this union as needed (e.g., "sui")
 * @param id - Chain ID, optional for EVM
 */

// Structure for native currency info (mirroring viem)
export type NativeCurrency = {
    name: string;
    symbol: string;
    decimals: number;
};

export type Chain =
    | EvmChain
    | SolanaChain
    | AptosChain
    | ChromiaChain
    | FuelChain
    | SuiChain
    | ZilliqaChain
    | CosmosChain
    | StarknetChain
    | RadixChain
    | ZetrixChain;

export type SuiChain = {
    type: "sui";
};

export type EvmChain = {
    type: "evm";
    id: number;
    nativeCurrency: NativeCurrency;
};

export type SolanaChain = {
    type: "solana";
    nativeCurrency: NativeCurrency;
};

export type AptosChain = {
    type: "aptos";
};

export type ChromiaChain = {
    type: "chromia";
};

export type FuelChain = {
    type: "fuel";
};

export type ZilliqaChain = {
    type: "zilliqa";
    id: number;
    evmId: number;
};

export type CosmosChain = {
    type: "cosmos";
};

export type StarknetChain = {
    type: "starknet";
};

export type RadixChain = {
    type: "radix";
    id: number;
};

export type ZetrixChain = {
    type: "zetrix";
};
