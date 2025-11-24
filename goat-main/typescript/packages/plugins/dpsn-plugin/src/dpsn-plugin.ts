import EventEmitter from "node:events";
import { PluginBase } from "@goat-sdk/core";
import { DpsnPluginService } from "./dpsn-plugin.service";
import { Dpsnservice } from "./dpsnClient";

// Interface for required plugin options
export interface DpsnPluginOptions {
    DPSN_URL: string;
    EVM_WALLET_PVT_KEY: string;
}

export class DpsnPlugin extends PluginBase {
    DpsnDataStream: EventEmitter;

    constructor(options: DpsnPluginOptions) {
        // Validate required parameters
        if (!options.DPSN_URL) {
            throw new Error("DPSN URL is required");
        }
        if (!options.EVM_WALLET_PVT_KEY) {
            throw new Error("EVM wallet private key is required");
        }

        const DpsnDataStream = new EventEmitter();

        super("dpsn-plugin", [
            new DpsnPluginService(new Dpsnservice(options.DPSN_URL, options.EVM_WALLET_PVT_KEY), DpsnDataStream),
        ]);
        this.DpsnDataStream = DpsnDataStream;
    }

    supportsChain = () => true;
}

// Factory function with required parameters
export function dpsnplugin(options: DpsnPluginOptions) {
    return new DpsnPlugin(options);
}
