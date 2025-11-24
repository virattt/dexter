import { PluginBase, WalletClientBase } from "@goat-sdk/core";
import { FarcasterClient } from "./farcaster.service";
import { FarcasterConfig } from "./types";

export class FarcasterPlugin extends PluginBase<WalletClientBase> {
    constructor(config: FarcasterConfig) {
        super("farcaster", [new FarcasterClient(config)]);
    }

    // Plugin supports all chains since Farcaster is chain-agnostic
    supportsChain = () => true;
}

export const farcasterPlugin = (config: FarcasterConfig) => new FarcasterPlugin(config);
