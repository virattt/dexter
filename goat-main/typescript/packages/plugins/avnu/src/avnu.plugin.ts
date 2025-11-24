import { type Chain, PluginBase } from "@goat-sdk/core";
import { StarknetWalletClient } from "@goat-sdk/wallet-starknet";
import { AvnuService } from "./avnu.service";

export class AvnuPlugin extends PluginBase<StarknetWalletClient> {
    constructor() {
        super("avnu", [new AvnuService()]);
    }

    supportsChain = (chain: Chain) => chain.type === "starknet";
}

export const avnu = () => new AvnuPlugin();
