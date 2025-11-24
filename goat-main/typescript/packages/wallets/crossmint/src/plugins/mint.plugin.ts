import type { CrossmintApiClient } from "@crossmint/common-sdk-base";
import { type Chain, PluginBase } from "@goat-sdk/core";
import type { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { isChainSupportedByMinting } from "../chains";
import { CrossmintMintService } from "./mint.service";

export class MintPlugin extends PluginBase<EVMWalletClient> {
    constructor(client: CrossmintApiClient) {
        super("mint", [new CrossmintMintService(client)]);
    }

    supportsChain(chain: Chain) {
        if (chain.type === "evm") {
            return isChainSupportedByMinting(chain.id ?? 0);
        }

        if (chain.type === "aptos" || chain.type === "solana") {
            return true;
        }

        return false;
    }
}

export function mintPlugin(client: CrossmintApiClient) {
    return () => {
        return new MintPlugin(client);
    };
}
