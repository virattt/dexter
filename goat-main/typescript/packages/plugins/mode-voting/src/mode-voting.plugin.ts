import { type Chain, PluginBase } from "@goat-sdk/core";
import type { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { mode } from "viem/chains";
import { ModeVotingService } from "./mode-voting.service";

const SUPPORTED_CHAINS = [mode];

export class ModeVotingPlugin extends PluginBase<EVMWalletClient> {
    constructor() {
        super("mode-voting", [new ModeVotingService()]);
    }

    supportsChain = (chain: Chain) => chain.type === "evm" && SUPPORTED_CHAINS.some((c) => c.id === chain.id);
}

export const modeVoting = () => new ModeVotingPlugin();
