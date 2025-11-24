import { Chain, PluginBase } from "@goat-sdk/core";
import { createTool } from "@goat-sdk/core";
import { z } from "zod";
import { ChromiaWalletClient } from "./ChromiaWalletClient";

export class SendCHRPlugin extends PluginBase<ChromiaWalletClient> {
    constructor() {
        super("sendCHR", []);
    }

    supportsChain(chain: Chain) {
        return chain.type === "chromia";
    }

    getTools(walletClient: ChromiaWalletClient) {
        const sendTool = createTool(
            {
                name: "send_CHR",
                description: "Send a Chromia asset to an address",
                parameters: sendCHRParametersSchema,
            },
            (parameters: z.infer<typeof sendCHRParametersSchema>) => sendCHRMethod(walletClient, parameters),
        );
        return [sendTool];
    }
}

export const sendCHR = () => new SendCHRPlugin();

const sendCHRParametersSchema = z.object({
    to: z.string().describe("The address to send the Chromia asset to"),
    amount: z.string().describe("The amount of the Chromia asset to send"),
});

async function sendCHRMethod(
    walletClient: ChromiaWalletClient,
    parameters: z.infer<typeof sendCHRParametersSchema>,
): Promise<string> {
    try {
        const { to, amount } = parameters;
        const { assetId, connection } = walletClient.params;
        const { receipt } = await walletClient.sendTransaction({
            to,
            assetId,
            amount,
        });

        return `https://explorer.chromia.com/${walletClient.networkName}/${connection.blockchainRid.toString(
            "hex",
        )}/transaction/${receipt.transactionRid.toString("hex")}`;
    } catch (error) {
        console.error("Debug - Error Details:", error);
        return `Error sending the Chromia asset. Ensure the recipient address, asset ID, and amount are correct. Details: ${error}`;
    }
}
