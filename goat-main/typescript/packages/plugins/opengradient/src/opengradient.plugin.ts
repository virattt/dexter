import { type Chain, PluginBase } from "@goat-sdk/core";
import { OpengradientService } from "./opengradient.service";
import { OpenGradientConfig } from "./types";

export type OpengradientPluginCtorParams = {
    config: OpenGradientConfig;
};

export class OpengradientPlugin extends PluginBase {
    constructor({ config }: OpengradientPluginCtorParams) {
        super("opengradient", [new OpengradientService(config)]);
    }

    supportsChain = (_chain: Chain) => true;
}

export function opengradient(params: OpengradientPluginCtorParams) {
    return new OpengradientPlugin(params);
}
