import { type Chain, PluginBase } from "@goat-sdk/core";
import { BalmyService } from "./balmy.service";

export class BalmyPlugin extends PluginBase {
    constructor() {
        super("balmy", [new BalmyService()]);
    }

    supportsChain = (chain: Chain) => chain.type === "evm";
}

export function balmy() {
    return new BalmyPlugin();
}
