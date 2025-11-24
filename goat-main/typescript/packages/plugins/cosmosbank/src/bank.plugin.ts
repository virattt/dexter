import { Chain, PluginBase } from "@goat-sdk/core";
import { CosmosClient } from "@goat-sdk/wallet-cosmos";
import { BankService } from "./bank.service";

export class BANKPlugin extends PluginBase<CosmosClient> {
    constructor() {
        super("cosmosbank", [new BankService()]);
    }

    supportsChain = (chain: Chain) => chain.type === "cosmos";
}

export async function cosmosbank() {
    return new BANKPlugin();
}
