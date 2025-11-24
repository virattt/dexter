import { Chain, PluginBase } from "@goat-sdk/core";
import { MayanService } from "./mayan.service";

export class MayanPlugin extends PluginBase {
    constructor() {
        super("mayan", [new MayanService()]);
    }

    supportsChain = (chain: Chain) => ["sui", "evm", "solana"].includes(chain.type);
}

export function mayan() {
    return new MayanPlugin();
}
