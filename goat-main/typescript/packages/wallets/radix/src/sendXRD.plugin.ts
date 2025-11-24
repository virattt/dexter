import { Chain, PluginBase, createTool } from "@goat-sdk/core";
import { manifests } from "radix-web3.js";
import { z } from "zod";
import { RadixWalletClient } from "./RadixWalletClient";

const sendXRDParametersSchema = z.object({
    to: z.string().describe("The recipient's address"),
    amount: z.string().describe("The amount you want to send"),
});

const sendXRDMethod = async (walletClient: RadixWalletClient, parameters: z.infer<typeof sendXRDParametersSchema>) => {
    try {
        const { to, amount } = parameters;

        const xrdAddress = await walletClient
            .getClient()
            .networkClient.getKnownAddresses()
            .then((res) => res.resourceAddresses.xrd);

        return walletClient.sendTransaction(
            manifests.sendResourceManifest({
                fromAddress: walletClient.getAddress(),
                toAddress: to,
                amount,
                resourceAddress: xrdAddress,
            }),
        );
    } catch (error) {
        throw new Error(`Failed to send XRD: ${error}`);
    }
};

export class SendXrdPlugin extends PluginBase<RadixWalletClient> {
    constructor() {
        super("sendXrd", []);
    }

    supportsChain = (chain: Chain) => chain.type === "radix";

    getTools(walletClient: RadixWalletClient): ReturnType<typeof createTool>[] {
        const sendTool = createTool(
            {
                name: "send_xrd",
                description: "Send xrd to an address.",
                parameters: sendXRDParametersSchema,
            },
            // Implement the method
            (parameters: z.infer<typeof sendXRDParametersSchema>) => sendXRDMethod(walletClient, parameters),
        );
        return [sendTool];
    }
}

export const sendXrd = () => new SendXrdPlugin();
