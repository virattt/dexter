import { Chain, PluginBase, createTool } from "@goat-sdk/core";
import { Transaction } from "@mysten/sui/transactions";
import { z } from "zod";
import { SuiWalletClient } from "./SuiWalletClient";

const sendSUIParametersSchema = z.object({
    to: z.string().describe("The recipient's address"),
    amount: z.number().describe("The amount of SUI to send"),
});

const sendSUIMethod = async (walletClient: SuiWalletClient, parameters: z.infer<typeof sendSUIParametersSchema>) => {
    const { to, amount } = parameters;
    const tx = new Transaction();
    const [coin] = tx.splitCoins(tx.gas, [amount]);
    tx.transferObjects([coin], to);
    return walletClient.sendTransaction({
        transaction: tx,
    });
};

export class SendSUIPlugin extends PluginBase<SuiWalletClient> {
    constructor() {
        super("sendSUI", []);
    }

    supportsChain = (chain: Chain) => chain.type === "sui";

    getTools(walletClient: SuiWalletClient) {
        const sendTool = createTool(
            {
                name: "send_sui",
                description: "Send SUI to an address.",
                parameters: sendSUIParametersSchema,
            },
            // Implement the method
            (parameters: z.infer<typeof sendSUIParametersSchema>) => sendSUIMethod(walletClient, parameters),
        );
        return [sendTool];
    }
}
