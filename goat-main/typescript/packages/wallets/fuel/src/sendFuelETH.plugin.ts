import { Chain, PluginBase, createTool } from "@goat-sdk/core";
import { z } from "zod";
import { FuelWalletClient } from "./FuelWalletClient";

const sendFuelETHParametersSchema = z.object({
    to: z.string().describe("The address to send ETH to"),
    amount: z.string().describe("The amount of ETH to send"),
});

export class SendFuelETHPlugin extends PluginBase<FuelWalletClient> {
    constructor() {
        super("sendFuelETH", []);
    }

    supportsChain(chain: Chain) {
        return chain.type === "fuel";
    }

    getTools(walletClient: FuelWalletClient) {
        const sendTool = createTool(
            {
                name: "send_fuel_ETH",
                description: "Send ETH to a Fuel address",
                parameters: sendFuelETHParametersSchema,
            },
            (parameters: z.infer<typeof sendFuelETHParametersSchema>) => sendFuelETHMethod(walletClient, parameters),
        );
        return [sendTool];
    }
}

async function sendFuelETHMethod(
    walletClient: FuelWalletClient,
    parameters: z.infer<typeof sendFuelETHParametersSchema>,
) {
    try {
        const { to, amount } = parameters;
        const tx = await walletClient.transfer(to, amount);
        return tx.hash;
    } catch (error) {
        throw new Error(`Failed to send ETH: ${error}`);
    }
}

export const sendFuelETH = () => new SendFuelETHPlugin();
