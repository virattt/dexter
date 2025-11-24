import { type Chain, PluginBase } from "@goat-sdk/core";
import { TensorService } from "./tensor.service";
import type { TensorPluginCtorParams } from "./types";

export class TensorPlugin extends PluginBase {
    constructor(params: TensorPluginCtorParams) {
        super("tensor", [new TensorService(params.apiKey)]);
    }

    supportsChain = (chain: Chain) => chain.type === "solana";
}

export const tensor = (apiKey: string) => new TensorPlugin({ apiKey });
