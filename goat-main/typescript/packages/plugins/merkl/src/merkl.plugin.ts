import { type Chain, PluginBase } from "@goat-sdk/core";
import { optimism } from "viem/chains";
import { MerklService } from "./merkl.service";

const SUPPORTED_CHAINS = [optimism];
export class MerklPlugin extends PluginBase {
    constructor() {
        super("merkl", [new MerklService()]);
    }

    supportsChain = (chain: Chain) => chain.type === "evm" && SUPPORTED_CHAINS.some((c) => c.id === chain.id);
}

export function merkl() {
    return new MerklPlugin();
}
