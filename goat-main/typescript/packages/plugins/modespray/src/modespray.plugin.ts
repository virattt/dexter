import { type Chain, PluginBase } from "@goat-sdk/core";
import type { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { base, baseSepolia, mode, modeTestnet, optimism, optimismSepolia } from "viem/chains";
import { ModeSprayService } from "./modespray.service";

const SUPPORTED_CHAINS = [mode, modeTestnet, baseSepolia, base, optimismSepolia, optimism];

export class ModeSprayPlugin extends PluginBase<EVMWalletClient> {
    constructor() {
        super("modespray", [new ModeSprayService()]);
    }

    supportsChain = (chain: Chain) => chain.type === "evm" && SUPPORTED_CHAINS.some((c) => c.id === chain.id);
}

export const modespray = () => new ModeSprayPlugin();
