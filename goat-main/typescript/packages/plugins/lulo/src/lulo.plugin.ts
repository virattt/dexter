import { PluginBase } from "@goat-sdk/core";
import { LuloService } from "./lulo.service";

export class LuloPlugin extends PluginBase {
    constructor() {
        super("lulo", [new LuloService()]);
    }

    supportsChain = () => true;
}

export function lulo() {
    return new LuloPlugin();
}
