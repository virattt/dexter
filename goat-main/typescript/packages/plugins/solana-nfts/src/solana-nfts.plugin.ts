import { type Chain, PluginBase } from "@goat-sdk/core";
import { SolanaNftsService } from "./solana-nfts.service";

export class SolanaNftsPlugin extends PluginBase {
    constructor() {
        super("solana-nfts", [new SolanaNftsService()]);
    }

    supportsChain = (chain: Chain) => chain.type === "solana";
}

export const nfts = () => new SolanaNftsPlugin();
