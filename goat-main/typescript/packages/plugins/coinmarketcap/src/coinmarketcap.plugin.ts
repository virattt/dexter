import { type Chain, PluginBase } from "@goat-sdk/core";
import { CoinmarketcapService } from "./coinmarketcap.service";

export interface CoinmarketcapOptions {
    apiKey: string;
}

export class CoinmarketcapPlugin extends PluginBase {
    constructor(private readonly options: CoinmarketcapOptions) {
        super("coinmarketcap", [new CoinmarketcapService(options.apiKey)]);
    }

    supportsChain(_chain: Chain): boolean {
        // This plugin doesn't require specific chain support as it's an API wrapper
        return true;
    }
}

export function coinmarketcap(options: CoinmarketcapOptions) {
    return new CoinmarketcapPlugin(options);
}
