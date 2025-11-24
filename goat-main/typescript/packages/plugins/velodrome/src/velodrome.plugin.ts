import { type Chain, PluginBase } from "@goat-sdk/core";
import type { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { mode } from "viem/chains";
import { VelodromeService } from "./velodrome.service";

const SUPPORTED_CHAINS = [mode];

export class VelodromePlugin extends PluginBase<EVMWalletClient> {
    constructor() {
        super("velodrome", [new VelodromeService()]);
    }

    supportsChain = (chain: Chain) => chain.type === "evm" && SUPPORTED_CHAINS.some((c) => c.id === chain.id);
}

export const velodrome = () => new VelodromePlugin();
