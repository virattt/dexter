import { type Chain, PluginBase } from "@goat-sdk/core";
import {
    arbitrum,
    arbitrumSepolia,
    avalanche,
    avalancheFuji,
    base,
    baseSepolia,
    mainnet,
    mantle,
    mantleSepoliaTestnet,
    mode,
    modeTestnet,
    optimism,
    optimismSepolia,
    sei,
    seiDevnet,
    sepolia,
} from "viem/chains";
import { OrderlyNetworkService } from "./orderly-network.service";

const SUPPORTED_CHAINS = [
    mode,
    modeTestnet,
    mainnet,
    sepolia,
    arbitrum,
    arbitrumSepolia,
    optimism,
    optimismSepolia,
    base,
    baseSepolia,
    mantle,
    mantleSepoliaTestnet,
    sei,
    seiDevnet,
    avalanche,
    avalancheFuji,
];

export class OrderlyNetworkPlugin extends PluginBase {
    constructor() {
        super("orderly-network", [new OrderlyNetworkService()]);
    }

    supportsChain = (chain: Chain) =>
        (chain.type === "evm" && SUPPORTED_CHAINS.some((c) => c.id === chain.id)) || chain.type === "solana";
}

export function orderlynetwork() {
    return new OrderlyNetworkPlugin();
}
