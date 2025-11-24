import { Tool } from "@goat-sdk/core";
import { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { Address, erc20Abi } from "viem";
import { QUOTER_ABI } from "./abi/quoter.abi";
import { ROUTER_ABI } from "./abi/router.abi";
import {
    AddLiquidityParams,
    GetInfoVelodromeTokensParams,
    SwapExactTokensParams,
    removeLiquidityParams,
} from "./parameters";

const ROUTER_ADDRESS: Record<number, string> = {
    34443: "0x3a63171DD9BebF4D07BC782FECC7eb0b890C2A45",
};

const QUOTER_ADDRESS: Record<number, string> = {
    34443: "0x2f7150B288ef1cc553207bD9fbd40D4e0e093B24",
};

const WETH_ADDRESS: Record<number, string> = {
    34443: "0x4200000000000000000000000000000000000006",
};

export class VelodromeService {
    @Tool({
        name: "swap_exact_tokens",
        description: "Swap an exact amount of tokens on Velodrome.",
    })
    async swapExactTokens(walletClient: EVMWalletClient, parameters: SwapExactTokensParams) {
        try {
            const userAddress = walletClient.getAddress();
            if (!userAddress) {
                throw new Error("Could not get user address");
            }

            const chain = walletClient.getChain();
            if (!chain) {
                throw new Error("Chain not configured in wallet client");
            }

            const routerAddress = ROUTER_ADDRESS[chain.id];
            if (!routerAddress) {
                throw new Error(`Router not found for chain ${chain.id}`);
            }

            parameters.tokenIn = this.getAddressForETH(parameters.tokenIn, chain.id);
            parameters.tokenOut = this.getAddressForETH(parameters.tokenOut, chain.id);
            parameters.stable = await this.isStablePairDynamic(parameters.tokenIn, parameters.tokenOut, chain.id);

            if (!this.isETHAddress(parameters.tokenIn, chain.id)) {
                const allowanceRaw = await walletClient.read({
                    address: parameters.tokenIn,
                    abi: erc20Abi,
                    functionName: "allowance",
                    args: [userAddress, routerAddress],
                });
                const allowance = BigInt(allowanceRaw.value as string);
                const amountInBigInt = BigInt(parameters.amountIn);
                if (allowance < amountInBigInt) {
                    await walletClient.sendTransaction({
                        to: parameters.tokenIn,
                        abi: erc20Abi,
                        functionName: "approve",
                        args: [routerAddress, amountInBigInt],
                    });
                }
            }

            // Get quote first
            const amountOutMin = await this.getQuote(
                walletClient,
                parameters.tokenIn,
                parameters.tokenOut,
                parameters.amountIn,
                parameters.stable,
            );

            // Apply slippage to quote (e.g. 0.5% slippage)
            const minAmountOut = (BigInt(amountOutMin) * BigInt(995)) / BigInt(1000);

            const timestamp = parameters.deadline;

            // Create route array
            const routes = [
                {
                    from: parameters.tokenIn,
                    to: parameters.tokenOut,
                    stable: parameters.stable,
                },
            ];

            let txHash: { hash: string };

            const swapType = this.isETHAddress(parameters.tokenIn, chain.id)
                ? "eth-to-token"
                : this.isETHAddress(parameters.tokenOut, chain.id)
                  ? "token-to-eth"
                  : "token-to-token";

            switch (swapType) {
                case "eth-to-token":
                    txHash = await walletClient.sendTransaction({
                        to: routerAddress,
                        abi: ROUTER_ABI,
                        functionName: "swapExactETHForTokens",
                        args: [minAmountOut, routes, parameters.to ?? userAddress, timestamp],
                        value: BigInt(parameters.amountIn),
                    });
                    break;
                case "token-to-eth":
                    txHash = await walletClient.sendTransaction({
                        to: routerAddress,
                        abi: ROUTER_ABI,
                        functionName: "swapExactTokensForETH",
                        args: [parameters.amountIn, minAmountOut, routes, parameters.to ?? userAddress, timestamp],
                    });
                    break;
                case "token-to-token":
                    txHash = await walletClient.sendTransaction({
                        to: routerAddress,
                        abi: ROUTER_ABI,
                        functionName: "swapExactTokensForTokens",
                        args: [parameters.amountIn, minAmountOut, routes, parameters.to ?? userAddress, timestamp],
                    });
                    break;
                default:
                    throw new Error("Swap type not recognized");
            }

            return {
                amountOutMin,
                tokenIn: parameters.tokenIn,
                tokenOut: parameters.tokenOut,
                chainId: chain.id,
                hash: txHash.hash,
            };
        } catch (error) {
            throw error instanceof Error ? error.message : JSON.stringify(error);
        }
    }

    private async isStablePairDynamic(tokenIn: string, tokenOut: string, chainId: number): Promise<boolean> {
        const stableTokenNames: [string, string][] = [["usdt", "usdc"]];
        const stablePairs: [string, string][] = [];

        for (const [tokenA, tokenB] of stableTokenNames) {
            const tokenAInfo = await this.getVelodromeTokenAddresses({ tokenName: tokenA });
            const tokenBInfo = await this.getVelodromeTokenAddresses({ tokenName: tokenB });

            const addressA = tokenAInfo.chains[chainId]?.contractAddress;
            const addressB = tokenBInfo.chains[chainId]?.contractAddress;

            if (addressA && addressB) {
                stablePairs.push([addressA.toLowerCase(), addressB.toLowerCase()]);
            }
        }

        const tokenInLower = tokenIn.toLowerCase();
        const tokenOutLower = tokenOut.toLowerCase();

        return stablePairs.some(
            ([a, b]) => (tokenInLower === a && tokenOutLower === b) || (tokenInLower === b && tokenOutLower === a),
        );
    }

    private getAddressForETH(token: string, chainId: number): string {
        if (token.toLowerCase() === "0x0") {
            return WETH_ADDRESS[chainId];
        }
        return token;
    }

    private isETHAddress(token: string, chainId: number): boolean {
        return token.toLowerCase() === WETH_ADDRESS[chainId].toLowerCase();
    }

    @Tool({
        name: "get_velodrome_token_address",
        description: "Get the address of the Velodrome contract.",
    })
    async getVelodromeTokenAddresses(parameters: GetInfoVelodromeTokensParams): Promise<Token> {
        const tokens: Record<string, Token> = {
            usdt: {
                decimals: 6,
                symbol: "USDT",
                name: "USDT",
                chains: {
                    34443: {
                        contractAddress: "0xf0f161fda2712db8b566946122a5af183995e2ed",
                    },
                },
            },
            usdc: {
                decimals: 6,
                symbol: "USDC",
                name: "USDC",
                chains: {
                    34443: {
                        contractAddress: "0xd988097fb8612cc24eeC14542bC03424c656005f",
                    },
                },
            },

            mode: {
                decimals: 18,
                symbol: "MODE",
                name: "Mode",
                chains: {
                    34443: {
                        contractAddress: "0xDfc7C877a950e49D2610114102175A06C2e3167a",
                    },
                },
            },

            weth: {
                decimals: 18,
                symbol: "WETH",
                name: "Wrapped Ether",
                chains: {
                    34443: {
                        contractAddress: "0x4200000000000000000000000000000000000006",
                    },
                },
            },
            eth: {
                decimals: 18,
                symbol: "ETH",
                name: "Ether",
                chains: {
                    34443: {
                        contractAddress: "0x4200000000000000000000000000000000000006",
                    },
                },
            },
        };

        const token = tokens[parameters.tokenName.toLowerCase()];
        if (!token) {
            throw new Error(`Token ${parameters.tokenName} not found`);
        }
        return token;
    }

    private async getQuote(
        walletClient: EVMWalletClient,
        tokenIn: string,
        tokenOut: string,
        amountIn: string,
        stable: boolean,
    ): Promise<string> {
        const quoterAddress = QUOTER_ADDRESS[walletClient.getChain()?.id || 34443];

        // Call quoter contract to get expected output amount
        const quote = await walletClient.read({
            address: quoterAddress,
            abi: QUOTER_ABI,
            functionName: "quoteExactInputSingleV2",
            args: [
                {
                    tokenIn,
                    tokenOut,
                    stable,
                    amountIn: BigInt(amountIn),
                },
            ],
        });

        // Extract the value from the quote object
        const quoteValue = (quote as { value: bigint }).value.toString();
        return quoteValue;
    }

    @Tool({
        name: "add_liquidity",
        description: "Add liquidity to a Velodrome pool. Gets quote first and ensures sufficient allowance.",
    })
    async addLiquidity(
        walletClient: EVMWalletClient,
        parameters: AddLiquidityParams,
    ): Promise<{ hash?: string; chainId?: number; error?: string }> {
        try {
            const userAddress = await walletClient.getAddress();
            if (!userAddress) {
                throw new Error("Could not get user address");
            }

            const chain = await walletClient.getChain();
            if (!chain) {
                throw new Error("Chain not configured in wallet client");
            }

            const routerAddress = ROUTER_ADDRESS[chain.id];
            if (!routerAddress) {
                throw new Error(`Router not found for chain ${chain.id}`);
            }

            // Get pool info and quotes
            const [token0, token1] = await this.sortTokens(walletClient, parameters.token0, parameters.token1);

            const poolAddress = await this.getPool(walletClient, token0, token1, parameters.stable);

            const [reserve0, reserve1] = await this.getReserves(walletClient, poolAddress);

            // Calculate optimal amounts based on current reserves
            const [amount0Optimal, amount1Optimal] = this.getOptimalAmounts(
                BigInt(parameters.amount0Desired),
                BigInt(parameters.amount1Desired),
                reserve0,
                reserve1,
            );

            // Verify amounts are within acceptable ranges
            if (
                BigInt(amount0Optimal) < BigInt(parameters.amount0Min) ||
                BigInt(amount1Optimal) < BigInt(parameters.amount1Min)
            ) {
                throw new Error("Insufficient liquidity minted");
            }

            const adjustedAmount0Min =
                BigInt(amount0Optimal) < BigInt(parameters.amount0Min)
                    ? amount0Optimal.toString()
                    : parameters.amount0Min;

            const adjustedAmount1Min =
                BigInt(amount1Optimal) < BigInt(parameters.amount1Min)
                    ? amount1Optimal.toString()
                    : parameters.amount1Min;

            const approvalHash0 = await walletClient.sendTransaction({
                to: token0 as Address,
                abi: erc20Abi,
                functionName: "approve",
                args: [routerAddress as Address, parameters.amount0Desired],
            });

            const approvalHash1 = await walletClient.sendTransaction({
                to: token1 as Address,
                abi: erc20Abi,
                functionName: "approve",
                args: [routerAddress as Address, parameters.amount1Desired],
            });

            const timestamp = Math.floor(Date.now() / 1000) + parameters.deadline;

            // Add liquidity using Router
            const hash = await walletClient.sendTransaction({
                to: routerAddress,
                abi: ROUTER_ABI,
                functionName: "addLiquidity",
                args: [
                    token0,
                    token1,
                    parameters.stable,
                    amount0Optimal,
                    amount1Optimal,
                    parameters.amount0Min,
                    parameters.amount1Min,
                    parameters.to || userAddress,
                    timestamp,
                ],
            });

            return { hash: hash.hash, chainId: chain.id };
        } catch (error) {
            return { error: error instanceof Error ? error.message : JSON.stringify(error) };
        }
    }

    private async sortTokens(walletClient: EVMWalletClient, tokenA: string, tokenB: string) {
        const routerAddress = ROUTER_ADDRESS[walletClient.getChain()?.id || 34443];
        const resultRaw = await walletClient.read({
            address: routerAddress as Address,
            abi: ROUTER_ABI,
            functionName: "sortTokens",
            args: [tokenA as Address, tokenB as Address],
        });
        const result = resultRaw.value as [Address, Address];
        return [result[0], result[1]];
    }

    private async getPool(
        walletClient: EVMWalletClient,
        token0: string,
        token1: string,
        stable: boolean,
    ): Promise<string> {
        const routerAddress = ROUTER_ADDRESS[walletClient.getChain()?.id || 34443];
        const poolContract = await walletClient.read({
            address: routerAddress,
            abi: ROUTER_ABI,
            functionName: "poolFor",
            args: [token0, token1, stable],
        });
        return poolContract.value as Address;
    }

    private async getReserves(walletClient: EVMWalletClient, poolAddress: string) {
        const resultRaw = await walletClient.read({
            address: poolAddress as Address,
            abi: [
                {
                    inputs: [],
                    name: "getReserves",
                    outputs: [
                        { internalType: "uint256", name: "_reserve0", type: "uint256" },
                        { internalType: "uint256", name: "_reserve1", type: "uint256" },
                        { internalType: "uint256", name: "_blockTimestampLast", type: "uint256" },
                    ],
                    stateMutability: "view",
                    type: "function",
                },
            ],
            functionName: "getReserves",
        });
        const result = resultRaw.value as [bigint, bigint];
        return [result[0], result[1]];
    }

    private getOptimalAmounts(
        amount0Desired: bigint,
        amount1Desired: bigint,
        reserve0: bigint,
        reserve1: bigint,
    ): [bigint, bigint] {
        if (reserve0 === 0n && reserve1 === 0n) {
            return [amount0Desired, amount1Desired];
        }

        const amount1Optimal = (amount0Desired * reserve1) / reserve0;
        if (amount1Optimal <= amount1Desired) {
            return [amount0Desired, amount1Optimal];
        }

        const amount0Optimal = (amount1Desired * reserve0) / reserve1;
        return [amount0Optimal, amount1Desired];
    }
    @Tool({
        name: "remove_liquidity",
        description: "remove liquidity to a Velodrome pool.",
    })
    async removeLiquidity(walletClient: EVMWalletClient, parameters: removeLiquidityParams) {
        try {
            const userAddress = walletClient.getAddress();

            const chain = walletClient.getChain();
            if (!chain) {
                throw new Error("Chain not configured in wallet client");
            }

            const routerAddress = ROUTER_ADDRESS[chain.id];
            if (!routerAddress) {
                throw new Error(`Router not found for chain ${chain.id}`);
            }

            // Get tokens in correct order
            const [token0, token1] = await this.sortTokens(walletClient, parameters.token0, parameters.token1);

            // Get pool address
            const poolContract = await this.getPool(walletClient, token0, token1, parameters.stable);

            let poolAddress: string;
            if (typeof poolContract === "object" && poolContract !== null) {
                const poolObj = poolContract as Record<string, unknown>;
                if ("value" in poolObj && typeof poolObj.value === "string") {
                    poolAddress = poolObj.value;
                } else if ("address" in poolObj && typeof poolObj.address === "string") {
                    poolAddress = poolObj.address;
                } else {
                    console.error(
                        "Pool contract is an object but does not have expected properties:",
                        JSON.stringify(poolContract, null, 2),
                    );
                    throw new Error("Could not extract pool address from pool contract");
                }
            } else if (typeof poolContract === "string") {
                poolAddress = poolContract;
            } else {
                console.error("Unexpected pool contract value:", poolContract);
                throw new Error("Pool address is not in a valid format");
            }

            // Get LP token balance for this pool
            let lpTokenBalanceRaw: unknown;
            try {
                lpTokenBalanceRaw = await walletClient.read({
                    address: poolAddress as Address,
                    abi: erc20Abi,
                    functionName: "balanceOf",
                    args: [userAddress],
                });
            } catch (error) {
                console.error("Error reading LP token balance:", error);
                return { error: `Failed to read LP token balance: ${String(error)}` };
            }

            let lpTokenBalance: string;
            try {
                if (lpTokenBalanceRaw === null || lpTokenBalanceRaw === undefined) {
                    lpTokenBalance = "0";
                } else if (typeof lpTokenBalanceRaw === "bigint") {
                    lpTokenBalance = lpTokenBalanceRaw.toString();
                } else if (typeof lpTokenBalanceRaw === "number") {
                    lpTokenBalance = lpTokenBalanceRaw.toString();
                } else if (typeof lpTokenBalanceRaw === "string") {
                    // Ensure it's a numeric string
                    if (/^\d+$/.test(lpTokenBalanceRaw)) {
                        lpTokenBalance = lpTokenBalanceRaw;
                    } else {
                        console.error("LP token balance is not a numeric string:", lpTokenBalanceRaw);
                        lpTokenBalance = "0";
                    }
                } else if (typeof lpTokenBalanceRaw === "object" && lpTokenBalanceRaw !== null) {
                    if ("toString" in lpTokenBalanceRaw && typeof lpTokenBalanceRaw.toString === "function") {
                        const stringVal = lpTokenBalanceRaw.toString();
                        if (/^\d+$/.test(stringVal)) {
                            lpTokenBalance = stringVal;
                        } else {
                            if ("value" in lpTokenBalanceRaw && lpTokenBalanceRaw.value !== undefined) {
                                const valueStr = String(lpTokenBalanceRaw.value);
                                if (/^\d+$/.test(valueStr)) {
                                    lpTokenBalance = valueStr;
                                } else {
                                    lpTokenBalance = "0";
                                }
                            } else {
                                lpTokenBalance = "0";
                            }
                        }
                    } else if ("value" in lpTokenBalanceRaw && lpTokenBalanceRaw.value !== undefined) {
                        const valueStr = String(lpTokenBalanceRaw.value);
                        if (/^\d+$/.test(valueStr)) {
                            lpTokenBalance = valueStr;
                        } else {
                            lpTokenBalance = "0";
                        }
                    } else {
                        lpTokenBalance = "0";
                    }
                } else {
                    console.error("Unexpected LP token balance type:", typeof lpTokenBalanceRaw);
                    lpTokenBalance = "0";
                }
            } catch (error) {
                console.error("Error processing LP token balance:", error);
                lpTokenBalance = "0";
            }

            if (!/^\d+$/.test(lpTokenBalance) || lpTokenBalance === "0") {
                if (lpTokenBalance === "0") {
                    return { error: "You don't have any LP tokens in this pool" };
                }
                return { error: `Invalid LP token balance: ${lpTokenBalance}` };
            }

            // Calculate the amount to withdraw
            let liquidityToRemove: string;
            let percentToRemove = 1.0; // Default to 100%

            try {
                // Handle the 'amount' parameter (as text)
                if (parameters.amount) {
                    const amountText = String(parameters.amount).toLowerCase();

                    if (amountText.includes("half") || amountText.includes("50%")) {
                        percentToRemove = 0.5;
                        const halfAmount = (BigInt(lpTokenBalance) * BigInt(50)) / BigInt(100);
                        liquidityToRemove = halfAmount.toString();
                    } else if (amountText.includes("quarter") || amountText.includes("25%")) {
                        percentToRemove = 0.25;
                        const quarterAmount = (BigInt(lpTokenBalance) * BigInt(25)) / BigInt(100);
                        liquidityToRemove = quarterAmount.toString();
                    } else if (amountText.includes("all") || amountText.includes("100%") || amountText === "all") {
                        percentToRemove = 1.0;
                        liquidityToRemove = lpTokenBalance;
                    } else {
                        // If it's a specific numeric value
                        const parsedAmount = Number.parseInt(amountText);
                        if (!Number.isNaN(parsedAmount)) {
                            liquidityToRemove = parsedAmount.toString();
                        } else {
                            // If it can't be parsed, use the entire balance
                            liquidityToRemove = lpTokenBalance;
                        }
                    }
                } else if (parameters.liquidity) {
                    const liquidityParam = String(parameters.liquidity);
                    if (liquidityParam.toLowerCase() === "all") {
                        liquidityToRemove = lpTokenBalance;
                    } else {
                        if (/^\d+$/.test(liquidityParam)) {
                            liquidityToRemove = liquidityParam;
                        } else {
                            liquidityToRemove = lpTokenBalance;
                        }
                    }
                } else {
                    liquidityToRemove = lpTokenBalance;
                }

                if (!/^\d+$/.test(liquidityToRemove)) {
                    console.error(`liquidityToRemove is not a valid number: ${liquidityToRemove}`);
                    return { error: `Invalid liquidity amount: ${liquidityToRemove}` };
                }

                // Validate there is enough liquidity to withdraw
                if (BigInt(liquidityToRemove) <= BigInt(0)) {
                    return { error: "No liquidity to remove" };
                }
            } catch (error) {
                console.error("Error calculating liquidity to remove:", error);
                return { error: `Failed to calculate removal amount: ${String(error)}` };
            }

            // Approve LP tokens to the router
            try {
                const approvalHash = await walletClient.sendTransaction({
                    to: poolAddress as Address,
                    abi: erc20Abi,
                    functionName: "approve",
                    args: [routerAddress as Address, liquidityToRemove],
                });
            } catch (approvalError) {
                console.error("Approval error details:", approvalError);
                return {
                    error: `Approval failed: ${String(approvalError)}`,
                    details: { approvalError },
                };
            }

            // Calculate deadline
            const deadline = parameters.deadline || 1800; // Default to 30 minutes
            const timestamp = Math.floor(Date.now() / 1000) + deadline;

            // Set amountAMin and amountBMin if not defined
            const amountAMin = parameters.amountAMin || "0";
            const amountBMin = parameters.amountBMin || "0";

            try {
                const removeTx = await walletClient.sendTransaction({
                    to: routerAddress as Address,
                    abi: ROUTER_ABI,
                    functionName: "removeLiquidity",
                    args: [
                        token0,
                        token1,
                        parameters.stable,
                        liquidityToRemove,
                        amountAMin,
                        amountBMin,
                        parameters.to || userAddress,
                        timestamp,
                    ],
                });

                const txHash = removeTx.hash || (typeof removeTx === "string" ? removeTx : "unknown");

                return {
                    success: true,
                    transactionHash: txHash,
                    liquidityRemoved: liquidityToRemove,
                    percentage: `${percentToRemove * 100}%`,
                    tokens: {
                        token0,
                        token1,
                    },
                };
            } catch (txError) {
                console.error("Transaction error details:", txError);
                return {
                    error: `Transaction failed: ${String(txError)}`,
                    approvalSuccess: true,
                    details: { txError },
                };
            }
        } catch (error) {
            console.error("Error in removeLiquidity:", error);
            return {
                error: String(error),
                details: { error },
            };
        }
    }
}

type Token = {
    decimals: number;
    symbol: string;
    name: string;
    chains: Record<number, { contractAddress: `0x${string}` }>;
};
