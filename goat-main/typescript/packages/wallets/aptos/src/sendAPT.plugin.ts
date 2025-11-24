import { Chain, PluginBase } from "@goat-sdk/core";
import { createTool } from "@goat-sdk/core";
import { parseUnits } from "viem";
import { z } from "zod";
import { AptosWalletClient } from "./AptosWalletClient";

export class SendAPTPlugin extends PluginBase<AptosWalletClient> {
    constructor() {
        super("sendAPT", []);
    }

    supportsChain(chain: Chain) {
        return chain.type === "aptos";
    }

    getTools(walletClient: AptosWalletClient) {
        const sendTool = createTool(
            {
                name: "send_APT",
                description: "Send APT to an address.",
                parameters: sendAPTParametersSchema,
            },
            (parameters: z.infer<typeof sendAPTParametersSchema>) => sendAPTMethod(walletClient, parameters),
        );
        return [sendTool];
    }
}

export const sendAPT = () => new SendAPTPlugin();

const sendAPTParametersSchema = z.object({
    to: z.string().describe("The address to send APT to"),
    amount: z.string().describe("The amount of APT to send"),
});

async function sendAPTMethod(
    walletClient: AptosWalletClient,
    parameters: z.infer<typeof sendAPTParametersSchema>,
): Promise<string> {
    try {
        const { to, amount } = parameters;
        const octas = parseUnits(amount, 8);

        const tx = await walletClient.sendTransaction({
            transactionData: {
                function: "0x1::coin::transfer",
                functionArguments: [to, octas],
                typeArguments: ["0x1::aptos_coin::AptosCoin"],
            },
        });
        return tx.hash;
    } catch (error) {
        throw new Error(`Failed to send SOL: ${error}`);
    }
}
