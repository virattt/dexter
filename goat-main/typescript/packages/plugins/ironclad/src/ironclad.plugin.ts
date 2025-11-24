import { type Chain, PluginBase } from "@goat-sdk/core";
import type { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { mode } from "viem/chains";
import { IroncladService } from "./ironclad.service";

const SUPPORTED_CHAINS = [mode];

export class IronCladPlugin extends PluginBase<EVMWalletClient> {
    constructor() {
        super("ironclad", [new IroncladService()]);
    }

    supportsChain = (chain: Chain) => chain.type === "evm" && SUPPORTED_CHAINS.some((c) => c.id === chain.id);
}

export const ironclad = () => new IronCladPlugin();
