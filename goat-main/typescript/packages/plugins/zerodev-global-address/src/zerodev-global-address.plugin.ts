import { type Chain, PluginBase } from "@goat-sdk/core";
import { arbitrum, base, mainnet, mode, optimism, polygon, scroll } from "viem/chains";
import { ZeroDevGlobalAddressService } from "./zerodev-global-address.service";
export * from "./types";

const SUPPORTED_CHAINS = [mainnet, polygon, base, optimism, arbitrum, mode, scroll];

export class ZeroDevGlobalAddressPlugin extends PluginBase {
    constructor() {
        super("zero-dev-global-address", [new ZeroDevGlobalAddressService()]);
    }

    supportsChain = (chain: Chain) => chain.type === "evm" && SUPPORTED_CHAINS.some((c) => c.id === chain.id);
}

export const zeroDevGlobalAddress = () => new ZeroDevGlobalAddressPlugin();
