import { type GetToolsParams, type ToolBase, type WalletClientBase, getTools } from "@goat-sdk/core";

import { type CoreTool, tool } from "ai";
import type { z } from "zod";

export type GetOnChainToolsParams<TWalletClient extends WalletClientBase> = GetToolsParams<TWalletClient>;

export async function getOnChainTools<TWalletClient extends WalletClientBase>({
    wallet,
    plugins,
}: GetOnChainToolsParams<TWalletClient>) {
    const tools: ToolBase[] = await getTools<TWalletClient>({
        wallet,
        plugins,
    });

    const aiTools: { [key: string]: CoreTool } = {};

    for (const t of tools) {
        aiTools[t.name] = tool({
            description: t.description,
            parameters: t.parameters,
            execute: async (arg: z.output<typeof t.parameters>) => {
                return await t.execute(arg);
            },
        });
    }

    return aiTools;
}
