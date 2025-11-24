/**
 * @fileoverview DeBridge Plugin for cross-chain token swaps and bridging
 */

import { type Chain, PluginBase, WalletClientBase } from "@goat-sdk/core";
import { DebridgeTools } from "./tools";

/**
 * Configuration options for the DeBridge plugin
 */
export type DebridgeOptions = {
    baseUrl?: string;
};

/** Default base URL for DeBridge API endpoints */
const DEFAULT_BASE_URL = "https://deswap.debridge.finance/v1.0";

/**
 * DeBridge Plugin class for handling cross-chain token operations
 * @extends PluginBase
 */
export class Debridge extends PluginBase<WalletClientBase> {
    constructor(options: DebridgeOptions = {}) {
        const baseUrl = options.baseUrl || DEFAULT_BASE_URL;
        super("debridge", [new DebridgeTools({ baseUrl })]);
    }

    supportsChain(chain: Chain): boolean {
        return chain.type === "evm"; // TODO: Add support for more blockchains
    }
}

/**
 * Factory function to create a new DeBridge plugin instance
 */
export const debridge = (options: DebridgeOptions = {}): Debridge => {
    return new Debridge(options);
};
