import { PluginBase } from "@goat-sdk/core";
import { Chain } from "@goat-sdk/core";
import { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { LifiService } from "./lifi.service";
export type LifiCtorParams = {
    apiKey?: string;
};

const supportedChains = [
    "1", // Ethereum
    "42161", // Arbitrum
    "43114", // Avalanche
    "8453", // Base
    "56", // BSC
    "10", // Optimism
    "137", // Polygon
    "100", // Gnosis Chain
    "42170", // Arbitrum Nova
    "81457", // Blast
    "5000", // Mantle
    "34443", // Mode
    "534352", // scroll
];

export class LifiPlugin extends PluginBase<EVMWalletClient> {
    constructor(params: LifiCtorParams) {
        super("lifi", [new LifiService(params.apiKey)]);
    }

    supportsChain = (chain: Chain) => chain.type === "evm" && supportedChains.includes(chain.id.toString());
}

export const lifi = (params: LifiCtorParams = {}) => new LifiPlugin(params);
