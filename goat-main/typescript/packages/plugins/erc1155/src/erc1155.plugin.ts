import { type Chain, PluginBase } from "@goat-sdk/core";
import type { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { Erc1155Service } from "./erc1155.service";
import { type Token } from "./token";

export type ERC1155PluginCtorParams = {
    tokens: Token[];
};

export class ERC1155Plugin extends PluginBase<EVMWalletClient> {
    constructor({ tokens }: ERC1155PluginCtorParams) {
        super("erc1155", [new Erc1155Service({ tokens })]);
    }

    supportsChain = (chain: Chain) => chain.type === "evm";
}

export function erc1155({ tokens }: ERC1155PluginCtorParams) {
    return new ERC1155Plugin({ tokens });
}
