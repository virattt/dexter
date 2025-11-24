import { type Chain, PluginBase } from "@goat-sdk/core";
import { OrcaService } from "./orca.service";

export class OrcaPlugin extends PluginBase {
    constructor() {
        super("orca", [new OrcaService()]);
    }

    supportsChain = (chain: Chain) => chain.type === "solana";
}

export const orca = () => new OrcaPlugin();
