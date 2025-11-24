import { z } from "zod";
import type { Chain } from "../types/Chain";
import type { Token } from "../types/Token";
import { type ToolBase, createTool } from "./ToolBase";

export type Signature = {
    signature: string;
};

export type Balance = {
    decimals: number;
    symbol: string;
    name: string;
    value: string;
    inBaseUnits: string;
};

export abstract class WalletClientBase {
    abstract getAddress(): string;
    abstract getChain(): Chain;
    abstract signMessage(message: string): Promise<Signature>;
    abstract balanceOf(address: string, tokenAddress?: string): Promise<Balance>;

    getTokenInfoByTicker(ticker: string): Promise<Token> {
        throw new Error("getTokenInfoByTicker is not implemented for this wallet client");
    }

    getCoreTools(): ToolBase[] {
        return [
            createTool(
                {
                    name: "get_address",
                    description: "Get the address of the wallet",
                    parameters: z.object({}),
                },
                () => this.getAddress(),
            ),
            createTool(
                {
                    name: "get_chain",
                    description: "Get the chain of the wallet",
                    parameters: z.object({}),
                },
                () => this.getChain(),
            ),
            createTool(
                {
                    name: "get_balance",
                    description:
                        "Get the balance of the wallet for the native token or a specific token by passing its address.",
                    parameters: z.object({
                        address: z.string(),
                        tokenAddress: z.string().optional(),
                    }),
                },
                (parameters) => this.balanceOf(parameters.address, parameters.tokenAddress),
            ),
            createTool(
                {
                    name: "sign_message",
                    description: "Sign a message with the wallet",
                    parameters: z.object({ message: z.string() }),
                },
                (parameters) => this.signMessage(parameters.message),
            ),
        ];
    }
}
