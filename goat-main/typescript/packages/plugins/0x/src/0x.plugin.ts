import { PluginBase } from "@goat-sdk/core";
import { Chain } from "@goat-sdk/core";
import { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { Referrer, ZeroExService } from "./0x.service";

export type ZeroExCtorParams = {
    apiKey: string;
    referrer?: Referrer;
};

const supportedChains = [
    "1",
    "42161", // arbitrum
    "43114", // avalanche
    "8453", // base
    "81457", // blast
    "56", // bsc
    "59144", // linea
    "5000", // mantle
    "34443", // mode
    "10", // optimism
    "137", // polygon
    "534352", // scroll
    "480", // worldcoin
];

export class ZeroExPlugin extends PluginBase<EVMWalletClient> {
    constructor(params: ZeroExCtorParams) {
        super("0x", [new ZeroExService(params.apiKey, params.referrer)]);
    }

    supportsChain = (chain: Chain) => chain.type === "evm" && supportedChains.includes(chain.id.toString());
}

export function zeroEx(params: ZeroExCtorParams) {
    return new ZeroExPlugin(params);
}
