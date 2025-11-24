import type { StarknetNetwork, Token } from "../tokens";

export interface StarknetTokenPluginCtorParams {
    /**
     * The Starknet network to use (mainnet, testnet, goerli)
     * @default "mainnet"
     */
    network?: StarknetNetwork;

    /**
     * List of tokens with their contract addresses, symbols, decimals, and names
     * @default STARKNET_TOKENS
     */
    tokens?: Token[];
}
