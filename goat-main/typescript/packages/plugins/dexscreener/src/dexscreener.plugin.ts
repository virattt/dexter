import { PluginBase } from "@goat-sdk/core";
import type { Chain, WalletClientBase } from "@goat-sdk/core";
import { DexscreenerService } from "./dexscreener.service";

/**
 * Plugin for interacting with Dexscreener API
 * Provides tools for fetching DEX pair data, token information, and market searches
 */
export class DexscreenerPlugin extends PluginBase<WalletClientBase> {
    constructor() {
        super("dexscreener", [new DexscreenerService()]);
    }

    /**
     * This plugin supports all chains as it's a data provider
     */
    supportsChain = (chain: Chain) => true;
}

/**
 * Utility factory function for creating a DexscreenerPlugin instance
 */
export function dexscreener() {
    return new DexscreenerPlugin();
}
