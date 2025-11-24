import { PluginBase } from "@goat-sdk/core";
import { OpenseaService } from "./opensea.service";

export class OpenseaPlugin extends PluginBase {
    constructor(apiKey: string) {
        super("opensea", [new OpenseaService(apiKey)]);
    }

    supportsChain = () => true;
}

export const opensea = (apiKey: string) => new OpenseaPlugin(apiKey);
