import { PluginBase } from "@goat-sdk/core";
import { BirdeyeApi } from "./api";
import { BirdeyeDefiService } from "./birdeye.service";

export interface BirdeyeOptions {
    apiKey: string;
}

export class BirdeyePlugin extends PluginBase {
    constructor(options: BirdeyeOptions) {
        super("birdeye", [new BirdeyeDefiService(new BirdeyeApi(options.apiKey))]);
    }

    supportsChain() {
        return true;
    }
}

/**
 * Factory function to create a new BirdEye plugin instance
 */
export function birdeye(options: BirdeyeOptions) {
    return new BirdeyePlugin(options);
}
