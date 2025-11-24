import { PluginBase } from "@goat-sdk/core";
import { Chain } from "@goat-sdk/core";
import { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { BalanceService } from "./service";

export type OneInchCtorParams = {
    apiKey: string;
};

export class OneInchPlugin extends PluginBase<EVMWalletClient> {
    constructor(params: OneInchCtorParams) {
        super("1inch", [new BalanceService(params)]);
    }

    supportsChain = (chain: Chain) => chain.type === "evm";
}

export function oneInch(params: OneInchCtorParams) {
    return new OneInchPlugin(params);
}
