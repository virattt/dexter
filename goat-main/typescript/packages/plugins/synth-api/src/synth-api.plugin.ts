import { PluginBase } from "@goat-sdk/core";
import { SynthAPI } from "./api";
import { SynthApiService } from "./synth-api.service";

interface SynthApiPluginOptions {
    apiKey: string;
}

export class SynthApiPlugin extends PluginBase {
    constructor({ apiKey }: SynthApiPluginOptions) {
        const api = new SynthAPI(apiKey);
        super("synth-api", [new SynthApiService(api)]);
    }

    supportsChain = () => true;
}

export function synthapi(options: SynthApiPluginOptions) {
    return new SynthApiPlugin(options);
}
