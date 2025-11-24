import { type Chain, PluginBase } from "@goat-sdk/core";
import type { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { arbitrum, base, bsc, linea, mode } from "viem/chains";
import { RenzoService } from "./renzo.service";

const SUPPORTED_CHAINS = [mode, base, arbitrum, bsc, linea];

export class RenzoPlugin extends PluginBase<EVMWalletClient> {
    constructor() {
        super("renzo", [new RenzoService()]);
    }

    supportsChain = (chain: Chain) => chain.type === "evm" && SUPPORTED_CHAINS.some((c) => c.id === chain.id);
}

export const renzo = () => new RenzoPlugin();
