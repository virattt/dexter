import { Chain, PluginBase, createTool } from "@goat-sdk/core";
import { EVMTransaction, EVMWalletClient } from "@goat-sdk/wallet-evm";
import { Address, formatUnits, parseUnits } from "viem";
import { z } from "zod";
import { validateConfig } from "./curves.config";
import { CurvesOptions } from "./types";

// Parameter Schemas
const addressSchema = z.string().describe("Ethereum address");
const amountSchema = z.number().describe("Amount of tokens");
const erc20Schema = z.object({
    name: z.string().describe("ERC20 token name"),
    symbol: z.string().describe("ERC20 token symbol"),
});
const createTokenAmountSchema = (decimals = 18, symbol = "tokens") =>
    z
        .string()
        .describe(`Amount in ${symbol} (e.g., '1.5' for 1.5 ${symbol})`)
        .refine((val) => {
            try {
                parseUnits(val, decimals);
                return true;
            } catch {
                return false;
            }
        }, `Invalid amount. Must be a valid decimal number with up to ${decimals} decimal places`);

export class CurvesPluginError extends Error {
    constructor(
        message: string,
        public readonly cause?: unknown,
    ) {
        super(message);
        this.name = "CurvesPluginError";
    }
}

export class CurvesPlugin extends PluginBase<EVMWalletClient> {
    private curves: Required<CurvesOptions>;

    constructor(curvesOpts?: CurvesOptions) {
        super("curves", []);

        const { curves } = validateConfig(curvesOpts);

        this.curves = curves;
    }

    supportsChain = (chain: Chain) => chain.type === "evm";

    getTools(walletClient: EVMWalletClient) {
        return [
            // Buy Curves Token Tool
            createTool(
                {
                    name: "buy_curves_token",
                    description: "Buy curves tokens for a specific subject",
                    parameters: z.object({
                        subject: addressSchema,
                        amount: amountSchema.optional().default(1),
                    }),
                },
                async (parameters) => {
                    try {
                        // Get buy price
                        const buyPrice = await this.getBuyPrice(
                            walletClient,
                            parameters.subject as Address,
                            parameters.amount,
                        );

                        // Prepare transaction
                        const transaction: EVMTransaction = {
                            to: this.curves.address,
                            abi: this.curves.abi,
                            functionName: "buyCurvesToken",
                            args: [parameters.subject as Address, parameters.amount],
                            value: buyPrice,
                            options: {
                                // TODO: add gasLimit as option
                                // gasLimit: parseUnits('3000000', 0),
                            },
                        };

                        // Send transaction
                        const tx = await walletClient.sendTransaction(transaction);
                        return tx.hash;
                    } catch (error) {
                        if (error instanceof CurvesPluginError) {
                            throw new CurvesPluginError(`Buy curves token failed: ${error.message}`, error);
                        }
                        throw new CurvesPluginError(
                            `Unexpected error while buying curves token for subject ${parameters.subject}`,
                            error,
                        );
                    }
                },
            ),

            // Get Curves Token Buy Price Tool
            createTool(
                {
                    name: "get_buy_curves_token",
                    description: "Get curves token buy price for a specific subject",
                    parameters: z.object({
                        subject: addressSchema,
                        amount: amountSchema.optional().default(1),
                        unit: z.enum(["wei", "gwei", "eth"]).optional().default("eth"),
                    }),
                },
                async (parameters) => {
                    try {
                        const price = await this.getBuyPrice(
                            walletClient,
                            parameters.subject as Address,
                            parameters.amount,
                        );
                        return formatPrice(price, {
                            unit: parameters.unit,
                            decimals: 18,
                            includeUnit: true,
                        });
                    } catch (error) {
                        if (error instanceof CurvesPluginError) {
                            throw new CurvesPluginError(`Get curves token buy price failed: ${error.message}`, error);
                        }
                        throw new CurvesPluginError(
                            `Unexpected error while reading curves token buy price for subject ${parameters.subject}`,
                            error,
                        );
                    }
                },
            ),

            // Sell Curves Token Tool
            createTool(
                {
                    name: "sell_curves_token",
                    description: "Sell curves tokens for a specific subject",
                    parameters: z.object({
                        subject: addressSchema,
                        amount: amountSchema.optional().default(1),
                    }),
                },
                async (parameters) => {
                    try {
                        const transaction: EVMTransaction = {
                            to: this.curves.address,
                            abi: this.curves.abi,
                            functionName: "sellCurvesToken",
                            args: [parameters.subject as Address, parameters.amount],
                            options: {
                                // TODO: add gasLimit as option
                                // gasLimit: parseUnits('200000', 0),
                            },
                        };

                        const tx = await walletClient.sendTransaction(transaction);
                        return tx.hash;
                    } catch (error) {
                        if (error instanceof CurvesPluginError) {
                            throw new CurvesPluginError(`Sell curves token failed: ${error.message}`, error);
                        }
                        throw new CurvesPluginError(
                            `Unexpected error while selling curves token for subject ${parameters.subject}`,
                            error,
                        );
                    }
                },
            ),

            // Get Curves Token Sell Price Tool
            createTool(
                {
                    name: "get_sell_curves_token",
                    description: "Get curves token sell price for a specific subject",
                    parameters: z.object({
                        subject: addressSchema,
                        amount: amountSchema.optional().default(1),
                        unit: z.enum(["wei", "gwei", "eth"]).optional().default("eth"),
                    }),
                },
                async (parameters) => {
                    try {
                        const price = await this.getSellPrice(
                            walletClient,
                            parameters.subject as Address,
                            parameters.amount,
                        );
                        return formatPrice(price, {
                            unit: parameters.unit,
                            decimals: 18,
                            includeUnit: true,
                        });
                    } catch (error) {
                        if (error instanceof CurvesPluginError) {
                            throw new CurvesPluginError(`Get curves token sell price failed: ${error.message}`, error);
                        }
                        throw new CurvesPluginError(
                            `Unexpected error while reading curves token sell price for subject ${parameters.subject}`,
                            error,
                        );
                    }
                },
            ),

            // Get ERC20 Info Tool
            createTool(
                {
                    name: "get_curves_erc20",
                    description: "Get Curves minted ERC20 token information for a subject",
                    parameters: z.object({
                        subject: addressSchema.optional(),
                    }),
                },
                async (parameters) => {
                    try {
                        const address = parameters.subject || walletClient.getAddress();
                        const { value } = (await walletClient.read({
                            address: this.curves.address,
                            abi: this.curves.abi,
                            functionName: "externalCurvesTokens",
                            args: [address],
                        })) as {
                            value: Array<string>;
                        };

                        return `ERC20 Token Details:
           Name: ${value[0]}
           Symbol: ${value[1]}
           Contract Address: ${value[2]}`;
                    } catch (error) {
                        if (error instanceof CurvesPluginError) {
                            throw new CurvesPluginError(`Failed to get ERC20 info: ${error.message}`, error);
                        }
                        throw new CurvesPluginError(
                            `Unexpected error while fetching ERC20 info for subject ${parameters.subject || "self"}`,
                            error,
                        );
                    }
                },
            ),

            // Get Balance Tool
            createTool(
                {
                    name: "get_curves_balance",
                    description: "Get curves token balance for a subject",
                    parameters: z.object({
                        subject: addressSchema,
                    }),
                },
                async (parameters) => {
                    try {
                        const result = await walletClient.read({
                            address: this.curves.address,
                            abi: this.curves.abi,
                            functionName: "curvesTokenBalance",
                            args: [parameters.subject, walletClient.getAddress()],
                        });

                        return `Curves Token Balance for ${parameters.subject}: ${result.value} tokens`;
                    } catch (error) {
                        if (error instanceof CurvesPluginError) {
                            throw new CurvesPluginError(`Failed to get balance: ${error.message}`, error);
                        }
                        throw new CurvesPluginError(
                            `Unexpected error while fetching balance for subject ${parameters.subject}`,
                            error,
                        );
                    }
                },
            ),

            // Withdraw Tool
            createTool(
                {
                    name: "withdraw_curves",
                    description: "Withdraw curves tokens to ERC20 tokens",
                    parameters: z.object({
                        subject: addressSchema,
                        amount: amountSchema.optional().default(1),
                    }),
                },
                async (parameters) => {
                    try {
                        const transaction: EVMTransaction = {
                            to: this.curves.address,
                            abi: this.curves.abi,
                            functionName: "withdraw",
                            args: [parameters.subject, parameters.amount],
                            options: {
                                // TODO: add gasLimit as option
                                // gasLimit: parseUnits('300000', 0),
                            },
                        };

                        const tx = await walletClient.sendTransaction(transaction);
                        return tx.hash;
                    } catch (error) {
                        if (error instanceof CurvesPluginError) {
                            throw new CurvesPluginError(`Withdrawal failed: ${error.message}`, error);
                        }
                        throw new CurvesPluginError(
                            `Unexpected error during withdrawal for subject ${parameters.subject}`,
                            error,
                        );
                    }
                },
            ),

            // Deposit Tool
            createTool(
                {
                    name: "deposit_curves",
                    description: "Deposit ERC20 tokens to curves tokens",
                    parameters: z.object({
                        subject: addressSchema,
                        amount: createTokenAmountSchema().optional().default("1"),
                    }),
                },
                async (parameters) => {
                    try {
                        // Parse input amount to ERC20 minimal denominatin (default is 18 decimals)
                        const depositAmount = parseUnits(parameters.amount, 18);
                        const transaction: EVMTransaction = {
                            to: this.curves.address,
                            abi: this.curves.abi,
                            functionName: "deposit",
                            args: [parameters.subject, depositAmount],
                            options: {
                                // TODO: add gasLimit as option
                                // gasLimit: parseUnits('300000', 0),
                            },
                        };

                        const tx = await walletClient.sendTransaction(transaction);
                        return tx.hash;
                    } catch (error) {
                        if (error instanceof CurvesPluginError) {
                            throw new CurvesPluginError(`Deposit failed: ${error.message}`, error);
                        }
                        throw new CurvesPluginError(
                            `Unexpected error during deposit for subject ${parameters.subject}`,
                            error,
                        );
                    }
                },
            ),

            // Set Mint Curves ERC20 Tool
            createTool(
                {
                    name: "mint_curves_erc20",
                    description: "Set name and symbol for your ERC20 token and mint it",
                    parameters: erc20Schema,
                },
                async (parameters) => {
                    try {
                        const transaction: EVMTransaction = {
                            to: this.curves.address,
                            abi: this.curves.abi,
                            functionName: "setNameAndSymbol",
                            args: [parameters.name, parameters.symbol, true],
                            options: {
                                // TODO: add gasLimit as option
                                // gasLimit: parseUnits('2000000', 0),
                            },
                        };

                        const tx = await walletClient.sendTransaction(transaction);
                        return tx.hash;
                    } catch (error) {
                        if (error instanceof CurvesPluginError) {
                            throw new CurvesPluginError(
                                `Failed to set ERC20 metadata and mint it: ${error.message}`,
                                error,
                            );
                        }
                        throw new CurvesPluginError(
                            `Unexpected error while setting ERC20 metadata and minting token (name: ${parameters.name}, symbol: ${parameters.symbol})`,
                            error,
                        );
                    }
                },
            ),
        ];
    }

    private async getBuyPrice(walletClient: EVMWalletClient, subject: string, amount: number): Promise<bigint> {
        const result = await walletClient.read({
            address: this.curves.address,
            abi: this.curves.abi,
            functionName: "getBuyPrice",
            args: [subject, amount],
        });

        // Assert result type
        const price = result.value as unknown;
        if (typeof price === "bigint") {
            return price;
        }

        // Handle other potential return types
        if (typeof price === "string" || typeof price === "number") {
            return BigInt(price);
        }

        throw new CurvesPluginError("Invalid price format returned from contract");
    }

    private async getSellPrice(walletClient: EVMWalletClient, subject: Address, amount: number): Promise<bigint> {
        const result = await walletClient.read({
            address: this.curves.address,
            abi: this.curves.abi,
            functionName: "getSellPrice",
            args: [subject, amount],
        });

        // Assert result type
        const price = result.value as unknown;
        if (typeof price === "bigint") {
            return price;
        }

        // Handle other potential return types
        if (typeof price === "string" || typeof price === "number") {
            return BigInt(price);
        }

        throw new CurvesPluginError("Invalid price format returned from contract");
    }
}

const formatPrice = (
    price: bigint,
    options?: {
        unit?: "wei" | "gwei" | "eth";
        decimals?: number;
        includeUnit?: boolean;
    },
) => {
    const defaultOptions = {
        unit: "eth" as const,
        decimals: 6,
        includeUnit: true,
    };
    const opts = { ...defaultOptions, ...options };

    const decimalsMap = {
        wei: 0,
        gwei: 9,
        eth: 18,
    };

    const formatted = formatUnits(price, decimalsMap[opts.unit]).slice(
        0,
        opts.decimals === 0 ? undefined : -18 + opts.decimals + 19,
    );

    return opts.includeUnit ? `${formatted} ${opts.unit.toUpperCase()}` : formatted;
};

// Export factory function
export const curves = (curvesOpts?: CurvesOptions) => new CurvesPlugin(curvesOpts);
