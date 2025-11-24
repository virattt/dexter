import { PluginBase } from "@goat-sdk/core";
import { AlloraService } from "./allora.service";

export interface AlloraPluginOptions {
    apiKey?: string;
    apiRoot?: string;
}

export class AlloraPlugin extends PluginBase {
    constructor(opts: AlloraPluginOptions) {
        super("allora", [new AlloraService(opts)]);
    }

    supportsChain = () => true;
}

export function allora(options: AlloraPluginOptions) {
    return new AlloraPlugin(options);
}
