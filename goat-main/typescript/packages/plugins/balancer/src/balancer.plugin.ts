import { Chain, PluginBase } from "@goat-sdk/core";
import { arbitrum, avalanche, base, fraxtal, gnosis, mode, optimism, polygon, polygonZkEvm } from "viem/chains";
import { BalancerService } from "./balancer.service";

export type BalancerConfig = {
    rpcUrl: string;
    apiUrl?: string;
};

const SUPPORTED_CHAINS = [mode, base, polygon, gnosis, arbitrum, avalanche, optimism, polygonZkEvm, fraxtal];

export class BalancerPlugin extends PluginBase {
    constructor(config: BalancerConfig) {
        super("balancer", [new BalancerService(config)]);
    }

    supportsChain = (chain: Chain) => chain.type === "evm" && SUPPORTED_CHAINS.some((c) => c.id === chain.id);
}

export function balancer(config: BalancerConfig) {
    return new BalancerPlugin(config);
}
