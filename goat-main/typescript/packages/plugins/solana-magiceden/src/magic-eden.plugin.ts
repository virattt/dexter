import { type Chain, PluginBase } from "@goat-sdk/core";
import { MagicEdenService } from "./magic-eden.service";

export class MagicEdenPlugin extends PluginBase {
    constructor(apiKey?: string) {
        super("magic-eden", [new MagicEdenService(apiKey)]);
    }

    supportsChain = (chain: Chain) => chain.type === "solana";
}

export const magicEden = (apiKey?: string) => new MagicEdenPlugin(apiKey);
