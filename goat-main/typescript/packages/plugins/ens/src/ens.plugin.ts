import { type Chain, PluginBase } from "@goat-sdk/core";
import type { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { EnsService } from "./ens.service";

type EnsPluginOptions = {
    provider?: string;
    chainId?: number;
};

export class EnsPlugin extends PluginBase<EVMWalletClient> {
    constructor(options: EnsPluginOptions) {
        super("ens", [new EnsService(options.provider, options.chainId)]);
    }

    supportsChain = (chain: Chain) => {
        return chain.type === "evm";
    };
}

export function ens({ provider, chainId }: EnsPluginOptions) {
    return new EnsPlugin({ provider, chainId });
}
