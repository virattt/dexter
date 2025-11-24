import { type Chain, PluginBase } from "@goat-sdk/core";
import { PlunderSwapService } from "./plunderswap.service";

export class PlunderSwapPlugin extends PluginBase {
    constructor() {
        super("plunderswap", [new PlunderSwapService()]);
    }

    supportsChain = (chain: Chain) => chain.type === "zilliqa";
}

export function plunderswap() {
    return new PlunderSwapPlugin();
}
