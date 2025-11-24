import { Chain, PluginBase, WalletClientBase } from "@goat-sdk/core";
import { EtherscanService } from "./etherscan.service";

interface EtherscanPluginOptions {
    apiKey: string;
}

export class EtherscanPlugin extends PluginBase<WalletClientBase> {
    constructor({ apiKey }: EtherscanPluginOptions) {
        super("etherscan", [new EtherscanService(apiKey)]);
    }

    supportsChain(chain: Chain): boolean {
        return chain.type === "evm";
    }
}

export function etherscan(options: EtherscanPluginOptions) {
    return new EtherscanPlugin(options);
}
