import { Chain, PluginBase } from "@goat-sdk/core";

import { WorldstoreService } from "./worldstore.service";

export class WorldstorePlugin extends PluginBase {
    constructor(baseUrl = "https://www.crossmint.com") {
        super("worldstore", [new WorldstoreService(baseUrl)]);
    }

    supportsChain(chain: Chain) {
        // base and base sepolia
        return chain.type === "evm" && [8453, 84532].includes(chain.id);
    }
}

export const worldstore = (baseUrl?: string) => new WorldstorePlugin(baseUrl);
