import { Chain, PluginBase, WalletClientBase } from "@goat-sdk/core";
import { JSONRpcService } from "./jsonrpc.service";

export type JSONRpcOptions = {
    endpoint: string;
};

export class JSONRpcPlugin extends PluginBase<WalletClientBase> {
    constructor({ endpoint }: JSONRpcOptions) {
        super("jsonrpc", [new JSONRpcService({ endpoint })]);
    }

    supportsChain = (chain: Chain) => true;
}

export function jsonrpc({ endpoint }: JSONRpcOptions) {
    return new JSONRpcPlugin({ endpoint });
}
