import { type GetToolsParams, type ToolBase, type WalletClientBase, getTools } from "@goat-sdk/core";
import { zodToJsonSchema } from "zod-to-json-schema";

export type GetOnChainToolsParams<TWalletClient extends WalletClientBase> = GetToolsParams<TWalletClient>;

export async function getOnChainTools<TWalletClient extends WalletClientBase>({
    wallet,
    plugins,
}: GetOnChainToolsParams<TWalletClient>) {
    const tools: ToolBase[] = await getTools<TWalletClient>({
        wallet,
        plugins,
    });

    return {
        listOfTools: () => {
            return tools.map((tool) => {
                return {
                    name: tool.name,
                    description: tool.description,
                    // biome-ignore lint/suspicious/noExplicitAny: need to infer the parameters type
                    inputSchema: zodToJsonSchema(tool.parameters as any),
                };
            });
        },
        toolHandler: async (name: string, parameters: unknown) => {
            const tool = tools.find((tool) => tool.name === name);
            if (!tool) {
                throw new Error(`Tool ${name} not found`);
            }

            const parsedParameters = tool.parameters.parse(parameters ?? {});
            const result = await tool.execute(parsedParameters);

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(result),
                    },
                ],
            };
        },
    };
}
