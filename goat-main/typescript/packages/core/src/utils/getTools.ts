import type { PluginBase } from "../classes/PluginBase";
import type { ToolBase } from "../classes/ToolBase";
import type { WalletClientBase } from "../classes/WalletClientBase";

export type GetToolsParams<TWalletClient extends WalletClientBase> = {
    wallet: TWalletClient;
    plugins?: (PluginBase<TWalletClient> | PluginBase<WalletClientBase>)[];
};
export async function getTools<TWalletClient extends WalletClientBase>({
    wallet,
    plugins = [],
}: GetToolsParams<TWalletClient>) {
    const tools: ToolBase[] = [];

    const chain = wallet.getChain();
    const coreTools = wallet.getCoreTools();

    for (const plugin of plugins) {
        if (!plugin.supportsChain(chain)) {
            console.warn(
                `Plugin ${plugin.name} does not support ${chain.type}${
                    "id" in chain ? ` chain id ${chain.id}` : ""
                }. Skipping.`,
            );
        }
        const pluginTools = await plugin.getTools(wallet);
        tools.push(...pluginTools);
    }

    return [...coreTools, ...tools];
}
