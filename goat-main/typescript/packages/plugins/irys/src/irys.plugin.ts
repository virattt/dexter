import { PluginBase } from "@goat-sdk/core";
import { IrysService } from "./irys.service";
import type { IrysPluginOptions } from "./types/IrysPluginOptions";

export class IrysPlugin extends PluginBase {
    constructor(parameters: IrysPluginOptions) {
        super("irys", [new IrysService(parameters)]);
    }

    supportsChain = () => true;
}

export function irys(options: IrysPluginOptions) {
    return new IrysPlugin(options);
}
