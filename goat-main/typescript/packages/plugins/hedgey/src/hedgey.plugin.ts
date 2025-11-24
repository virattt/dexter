import { type Chain, PluginBase } from "@goat-sdk/core";
import { optimism } from "viem/chains";
import { HedgeyService } from "./hedgey.service";

const SUPPORTED_CHAINS = [optimism];

export class HedgeyPlugin extends PluginBase {
    constructor() {
        super("hedgey", [new HedgeyService()]);
    }

    supportsChain = (chain: Chain) => chain.type === "evm" && SUPPORTED_CHAINS.some((c) => c.id === chain.id);
}

export function hedgey() {
    return new HedgeyPlugin();
}
