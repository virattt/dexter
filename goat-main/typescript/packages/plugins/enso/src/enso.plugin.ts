import { PluginBase } from "@goat-sdk/core";
import { EnsoService } from "./enso.service";

export interface EnsoPluginConstructorParams {
    apiKey?: string;
}

export class EnsoPlugin extends PluginBase {
    constructor(params: EnsoPluginConstructorParams) {
        super("enso", [new EnsoService(params)]);
    }

    supportsChain = () => true;
}

export function enso(params: EnsoPluginConstructorParams) {
    return new EnsoPlugin(params);
}
