import { type StoredToolMetadataMap, toolMetadataKey } from "../decorators/Tool";
import type { Chain } from "../types/Chain";
import { type ToolBase, createTool } from "./ToolBase";
import type { WalletClientBase } from "./WalletClientBase";

/**
 * Abstract base class for plugins that provide tools for wallet interactions.
 */
export abstract class PluginBase<TWalletClient extends WalletClientBase = WalletClientBase> {
    /**
     * Creates a new Plugin instance.
     * @param name - The name of the plugin
     * @param toolProviders - Array of class instances that provide tools
     */
    constructor(
        public readonly name: string,
        // biome-ignore lint/complexity/noBannedTypes: Object is the correct type, referring to instances of classes
        public readonly toolProviders: Object[],
    ) {}

    /**
     * Checks if the plugin supports a specific blockchain.
     * @param chain - The blockchain to check support for
     * @returns True if the chain is supported, false otherwise
     */
    abstract supportsChain(chain: Chain): boolean;

    /**
     * Retrieves the tools provided by the plugin.
     * @param wallet - The wallet client to use for tool execution
     * @returns An array of tools
     */
    getTools(walletClient: TWalletClient): ToolBase[] | Promise<ToolBase[]> {
        const tools: ToolBase[] = [];

        for (const toolProvider of this.toolProviders) {
            const toolsMap = Reflect.getMetadata(toolMetadataKey, toolProvider.constructor) as
                | StoredToolMetadataMap
                | undefined;

            if (!toolsMap) {
                const constructorName = toolProvider.constructor.name;
                if (constructorName === "Function") {
                    console.warn(
                        "Detected a non-instance tool provider. Please ensure you're passing instances of your tool providers, by using `new MyToolProvider(..)`",
                    );
                } else {
                    console.warn(
                        `No tools found for ${constructorName}. Please ensure you're using the '@Tool' decorator to expose your tools.`,
                    );
                }
                continue;
            }

            for (const tool of toolsMap.values()) {
                tools.push(
                    createTool(
                        {
                            name: tool.name,
                            description: tool.description,
                            parameters: tool.parameters.schema,
                        },
                        (params) => {
                            const args = [];
                            if (tool.walletClient) {
                                args[tool.walletClient.index] = walletClient;
                            }
                            args[tool.parameters.index] = params;

                            return tool.target.apply(toolProvider, args);
                        },
                    ),
                );
            }
        }

        return tools;
    }
}
