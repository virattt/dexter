import { type GetToolsParams, ToolBase, type WalletClientBase, getTools } from "@goat-sdk/core";

import type { JSONSchemaType } from "ajv";
import { FunctionTool } from "llamaindex";
import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export type GetOnChainToolsParams<TWalletClient extends WalletClientBase> = GetToolsParams<TWalletClient>;

export async function getOnChainTools<TWalletClient extends WalletClientBase>({
    wallet,
    plugins,
}: GetOnChainToolsParams<TWalletClient>) {
    const tools: ToolBase[] = await getTools({ wallet, plugins });

    return tools.map(
        (t) =>
            new FunctionTool(
                async (arg: z.output<typeof t.parameters>) => {
                    return await t.execute(arg);
                },
                {
                    name: t.name,
                    description: t.description,
                    parameters: zodToJsonSchema(t.parameters, {
                        target: "jsonSchema7",
                    }) as JSONSchemaType<z.output<typeof t.parameters>>,
                },
            ),
    );
}
