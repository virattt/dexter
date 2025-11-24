import { type Chain, PluginBase, type ToolBase } from "@goat-sdk/core";
import type { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { polygon } from "viem/chains";
import { type ApiKeyCredentials, createOrDeriveAPIKey, createOrder } from "./api";
import { getTools } from "./tools";

export type PolymarketOptions = {
    credentials: ApiKeyCredentials;
};

export class PolymarketPlugin extends PluginBase<EVMWalletClient> {
    constructor(private readonly options: PolymarketOptions) {
        super("polymarket", []);
    }

    supportsChain(chain: Chain): boolean {
        return chain.type === "evm" && chain.id === polygon.id;
    }

    public async getTools(walletClient: EVMWalletClient): Promise<ToolBase[]> {
        return getTools(walletClient, this.options);
    }
}

export function polymarket(options: PolymarketOptions) {
    return new PolymarketPlugin(options);
}

export { createOrDeriveAPIKey, createOrder };
