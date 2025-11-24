import {
    type GetToolsParams,
    type ToolBase,
    type WalletClientBase,
    addParametersToDescription,
    getTools,
} from "@goat-sdk/core";

import type { z } from "zod";

export type GetOnChainToolsParams<TWalletClient extends WalletClientBase> = {
    options?: {
        logTools?: boolean;
    };
} & GetToolsParams<TWalletClient>;

type ElevenLabsTool = (
    // biome-ignore lint/suspicious/noExplicitAny: any is returned by the ElevenLabs tools
    parameters: any,
    // biome-ignore lint/suspicious/noConfusingVoidType: void is returned by the ElevenLabs tools
) => Promise<string | number | void> | string | number | void;

export async function getOnChainTools<TWalletClient extends WalletClientBase>({
    wallet,
    plugins,
    options,
}: GetOnChainToolsParams<TWalletClient>) {
    const tools: ToolBase[] = await getTools<TWalletClient>({
        wallet,
        plugins,
    });

    const elevenLabsTools: { [key: string]: ElevenLabsTool } = {};

    if (options?.logTools) {
        console.log("Tools:\n");
    }

    for (const [index, t] of tools.entries()) {
        elevenLabsTools[t.name] = async (parameters: z.output<typeof t.parameters>) => {
            return JSON.stringify(await t.execute(parameters));
        };

        if (options?.logTools) {
            console.log(
                `\n${index + 1}. ${t.name}\n\nDescription: ${
                    t.description
                }\n\nParameters:\n${addParametersToDescription("", t.parameters)}\n`,
            );
        }
    }

    return elevenLabsTools;
}
