import { type Chain, PluginBase, type WalletClientBase, createTool } from "@goat-sdk/core";
import { z } from "zod";
// Since we are creating a chain-agnostic plugin, we can use the WalletClientBase interface
export class GetAddressPlugin extends PluginBase<WalletClientBase> {
    constructor() {
        // We define the name of the plugin
        super("getSafeAddress", []);
    }

    // We define the chain support for the plugin, in this case we support all chains
    supportsChain = (chain: Chain) => chain.type === "evm";

    getTools(walletClient: WalletClientBase) {
        return [
            createTool(
                {
                    name: "get_safe_address",
                    description: "Get the address of the agent's Safe",
                    parameters: z.NEVER,
                },
                () => {
                    // Return just the address without additional formatting
                    return walletClient.getAddress();
                },
            ),
        ];
    }
}

// We export a factory function to create a new instance of the plugin
export const getAddressPlugin = () => new GetAddressPlugin();
