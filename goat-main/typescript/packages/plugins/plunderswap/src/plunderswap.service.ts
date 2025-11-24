import { Tool } from "@goat-sdk/core";
import { ZilliqaWalletClientViemOnly } from "@goat-sdk/wallet-zilliqa";
import { type PublicClient, formatUnits, getContract, parseAbi, parseUnits } from "viem";
import textAbiErc20 from "../abi/ERC20.json";
import textAbiPlunderFactory from "../abi/IPlunderFactory.json";
import textAbiPlunderPair from "../abi/IPlunderPair.json";
import textAbiPlunderRouter from "../abi/IPlunderRouter01.json";
import textAbiWrappedZil from "../abi/WZIL.json";
import {
    BalanceParameters,
    QuoteParameters,
    SwapParameters,
    TokensParameters,
    WZilDepositParameters,
    WZilWithdrawParameters,
} from "./types";

type HexString = `0x${string}`;

type ContractAddresses = {
    factory: HexString;
    router: HexString;
};

type LiquidityPair = {
    tokens: [Token, Token];
    reserves: [bigint, bigint];
};

type Token = {
    symbol: string;
    address: HexString;
    decimals: number;
};

type Tokens = {
    bySymbol: Map<string, Token>;
    byAddress: Map<string, Token>;
};

type Reserves = {
    from: bigint;
    to: bigint;
};

type TradeDirect = {
    reserves: Reserves;
};

type TradeFrom = {
    tokenTo: Token;
    reserves: Reserves;
};

type TradeTo = {
    tokenFrom: Token;
    reserves: Reserves;
};

type TradePlan = {
    tokenPath: Token[];
    quote: bigint;
};

const WZIL_SYMBOL: string = "WZIL";

function getContractAddresses(chainId: number): ContractAddresses {
    if (chainId === 32769) {
        return {
            factory: "0xf42d1058f233329185A36B04B7f96105afa1adD2",
            router: "0x33C6a20D2a605da9Fd1F506ddEd449355f0564fe",
        };
    }
    if (chainId === 33101) {
        return {
            factory: "0xd0156eFCA4D847E4c4aD3F9ECa7FA697bb105cC0",
            router: "0x144e7AEee22F388350E9EAEFBb626A021fcd0250",
        };
    }
    throw `unknown chain ${chainId}`;
}

export class PlunderSwapService {
    private erc20Abi = parseAbi(textAbiErc20);
    private pairAbi = parseAbi(textAbiPlunderPair);
    private factoryAbi = parseAbi(textAbiPlunderFactory);
    private routerAbi = parseAbi(textAbiPlunderRouter);
    private wZilAbi = parseAbi(textAbiWrappedZil);

    private tokensByChain = new Map<number, Tokens>();

    private async ensureTokens(chainId: number) {
        if (this.tokensByChain.has(chainId)) {
            return;
        }
        let uri: string;
        if (chainId === 32769) {
            uri = "https://plunderswap.github.io/token-lists/default-mainnet.json";
        } else if (chainId === 33101) {
            uri = "https://plunderswap.com/lists/default-testnet.json";
        } else {
            throw `unknown chain ${chainId}`;
        }
        const response = await fetch(uri);
        if (!response.ok) {
            throw `failed to fetch tokens for chain ${chainId}: ${response.statusText}`;
        }
        const responseObject = await response.json();
        const responseTokens: [Token] = responseObject.tokens;
        const tokensByName = new Map<string, Token>();
        const tokensByAddress = new Map<string, Token>();
        for (const token of responseTokens) {
            tokensByName.set(token.symbol, token);
            tokensByAddress.set(token.address.toLowerCase(), token);
        }
        this.tokensByChain.set(chainId, {
            bySymbol: tokensByName,
            byAddress: tokensByAddress,
        });
    }

    private async getLiquidityPair(
        viemPublic: PublicClient,
        tokens: Tokens,
        address: HexString,
    ): Promise<LiquidityPair | null> {
        const pair = getContract({
            address,
            abi: this.pairAbi,
            client: viemPublic,
        });
        const tokenAddress0 = (await pair.read.token0()) as HexString;
        const tokenAddress1 = (await pair.read.token1()) as HexString;
        const token0 = tokens?.byAddress.get(tokenAddress0.toLowerCase());
        const token1 = tokens?.byAddress.get(tokenAddress1.toLowerCase());
        if (!token0 || !token1) {
            return null;
        }
        const reserves = (await pair.read.getReserves()) as unknown[];
        const reserve0 = reserves[0] as bigint;
        const reserve1 = reserves[1] as bigint;
        if ([reserve0, reserve1].includes(BigInt(0))) {
            return null;
        }
        return {
            tokens: [token0, token1],
            reserves: [reserve0, reserve1],
        };
    }

    private async getLiquidityPairs(
        viemPublic: PublicClient,
        contracts: ContractAddresses,
        tokens: Tokens,
    ): Promise<LiquidityPair[]> {
        const factory = getContract({
            address: contracts.factory,
            abi: this.factoryAbi,
            client: viemPublic,
        });
        const pairCount = (await factory.read.allPairsLength()) as bigint;
        const pairs: LiquidityPair[] = [];
        const batchSize = 4;
        for (let pairIndex = 0; pairIndex < pairCount; pairIndex += batchSize) {
            const pairBatch: Promise<LiquidityPair | null>[] = [];
            for (let subIndex = 0; subIndex < batchSize && pairIndex + subIndex < pairCount; subIndex++) {
                pairBatch.push(
                    factory.read
                        .allPairs([pairIndex + subIndex])
                        .then((address) => this.getLiquidityPair(viemPublic, tokens, address as HexString)),
                );
            }
            pairs.push(...(await Promise.all(pairBatch)).filter((pair) => pair !== null));
        }
        return pairs;
    }

    async planSwap(
        liquidityPairs: LiquidityPair[],
        fromToken: Token,
        fromAmount: bigint,
        toToken: Token,
    ): Promise<TradePlan> {
        if (fromToken === toToken) {
            throw "tokens must differ";
        }
        const tradeDirect: TradeDirect[] = [];
        const tradeFrom: TradeFrom[] = [];
        const tradeTo: TradeTo[] = [];
        for (let pairIndex = 0; pairIndex < liquidityPairs.length; pairIndex++) {
            const pair = liquidityPairs[pairIndex];
            const hasFromToken = pair.tokens.includes(fromToken);
            const hasToToken = pair.tokens.includes(toToken);
            if (hasFromToken) {
                if (hasToToken) {
                    if (fromToken === pair.tokens[0]) {
                        tradeDirect.push({
                            reserves: {
                                from: pair.reserves[0],
                                to: pair.reserves[1],
                            },
                        });
                    } else {
                        tradeDirect.push({
                            reserves: {
                                from: pair.reserves[1],
                                to: pair.reserves[0],
                            },
                        });
                    }
                } else {
                    if (fromToken === pair.tokens[0]) {
                        tradeFrom.push({
                            reserves: {
                                from: pair.reserves[0],
                                to: pair.reserves[1],
                            },
                            tokenTo: pair.tokens[1],
                        });
                    } else {
                        tradeFrom.push({
                            reserves: {
                                from: pair.reserves[1],
                                to: pair.reserves[0],
                            },
                            tokenTo: pair.tokens[0],
                        });
                    }
                }
            } else if (hasToToken) {
                if (toToken === pair.tokens[1]) {
                    tradeTo.push({
                        reserves: {
                            from: pair.reserves[0],
                            to: pair.reserves[1],
                        },
                        tokenFrom: pair.tokens[0],
                    });
                } else {
                    tradeTo.push({
                        reserves: {
                            from: pair.reserves[1],
                            to: pair.reserves[0],
                        },
                        tokenFrom: pair.tokens[1],
                    });
                }
            }
        }
        let bestToAmount = BigInt(0);
        let bestSwapPath: Token[] = [];
        const feeMultiplierFrom = BigInt(9965);
        const feeMultiplierTo = BigInt(10000);
        for (const direct of tradeDirect) {
            if (direct.reserves.from < fromAmount) {
                continue;
            }
            const fromProduct = feeMultiplierFrom * fromAmount;
            const toAmount =
                (fromProduct * direct.reserves.to) / (feeMultiplierTo * direct.reserves.from + fromProduct);
            if (direct.reserves.to < toAmount) {
                continue;
            }
            if (toAmount > bestToAmount) {
                bestToAmount = toAmount;
                bestSwapPath = [fromToken, toToken];
            }
        }
        for (const from of tradeFrom) {
            for (const to of tradeTo) {
                if (from.tokenTo === to.tokenFrom) {
                    if (from.reserves.from < fromAmount) {
                        continue;
                    }
                    const fromProduct = feeMultiplierFrom * fromAmount;
                    const betweenAmount =
                        (fromProduct * from.reserves.to) / (feeMultiplierTo * from.reserves.from + fromProduct);
                    if (from.reserves.to < betweenAmount || to.reserves.from < betweenAmount) {
                        continue;
                    }
                    const betweenProduct = feeMultiplierFrom * betweenAmount;
                    const toAmount =
                        (betweenProduct * to.reserves.to) / (feeMultiplierTo * to.reserves.from + betweenProduct);
                    if (to.reserves.to < toAmount) {
                        continue;
                    }
                    if (toAmount > bestToAmount) {
                        bestToAmount = toAmount;
                        bestSwapPath = [fromToken, from.tokenTo, toToken];
                    }
                }
            }
        }
        if (bestToAmount === BigInt(0)) {
            throw "cannot make that swap";
        }
        return { tokenPath: bestSwapPath, quote: bestToAmount };
    }

    private async ensureApproval(
        walletClient: ZilliqaWalletClientViemOnly,
        tokenAddress: HexString,
        spender: HexString,
        amount: bigint,
    ): Promise<HexString | null> {
        const viemPublic = walletClient.getViemPublicClient();
        const viemWallet = walletClient.getViemWalletClient();
        const erc20 = getContract({
            address: tokenAddress,
            abi: this.erc20Abi,
            client: {
                public: viemPublic,
                wallet: viemWallet,
            },
        });
        const [address] = await viemWallet.getAddresses();
        const amountGranted = (await erc20.read.allowance([address, spender])) as bigint;
        if (amount <= amountGranted) {
            return null;
        }
        const approveTxHash = await erc20.write.approve([spender, amount]);
        await viemPublic.waitForTransactionReceipt({
            hash: approveTxHash,
        });
        return approveTxHash;
    }

    @Tool({
        name: "plunderswap_tokens",
        description: "Get the symbols for the tokens on the current blockchain that can be exchaged using PlunderSwap.",
    })
    async getTokens(walletClient: ZilliqaWalletClientViemOnly, _parameters: TokensParameters) {
        const viemPublic = walletClient.getViemPublicClient();
        const chainId = await viemPublic.getChainId();
        const contracts = getContractAddresses(chainId);
        await this.ensureTokens(chainId);
        const tokens = this.tokensByChain.get(chainId);
        if (!tokens) {
            return { tokens: [] };
        }
        const pairs = await this.getLiquidityPairs(viemPublic, contracts, tokens);
        const symbols = new Set<string>();
        for (const pair of pairs) {
            for (const token of pair.tokens) {
                symbols.add(token.symbol);
            }
        }
        return {
            tokens: Array.from(symbols),
        };
    }

    @Tool({
        name: "plunderswap_balance",
        description: "Get the user's balance for a token that is registered with PlunderSwap.",
    })
    async getBalance(walletClient: ZilliqaWalletClientViemOnly, parameters: BalanceParameters) {
        const viemPublic = walletClient.getViemPublicClient();
        const viemWallet = walletClient.getViemWalletClient();
        const chainId = await viemPublic.getChainId();
        await this.ensureTokens(chainId);
        const tokens = this.tokensByChain.get(chainId);
        const token = tokens?.bySymbol.get(parameters.token);
        if (!token) {
            throw `unknown token ${parameters.token} on chain ${chainId}`;
        }
        const erc20 = getContract({
            address: token.address,
            abi: this.erc20Abi,
            client: viemPublic,
        });
        const [address] = await viemWallet.getAddresses();
        const amount = (await erc20.read.balanceOf([address])) as bigint;
        return {
            amount: formatUnits(amount, token.decimals),
        };
    }

    @Tool({
        name: "plunderswap_quote",
        description:
            "Get a quote for how many tokens would be received if the given tokens were swapped for another token.",
    })
    async getQuote(walletClient: ZilliqaWalletClientViemOnly, parameters: QuoteParameters) {
        if (parameters.fromToken === parameters.toToken) {
            throw "tokens must differ";
        }
        const viemPublic = walletClient.getViemPublicClient();
        const chainId = await viemPublic.getChainId();
        const contracts = getContractAddresses(chainId);
        await this.ensureTokens(chainId);
        const tokens = this.tokensByChain.get(chainId);
        if (!tokens) {
            throw `unknown chain ${chainId}`;
        }
        const fromTokenInfo = tokens.bySymbol.get(parameters.fromToken);
        const toTokenInfo = tokens.bySymbol.get(parameters.toToken);
        if (!fromTokenInfo) {
            throw `unknown token ${parameters.fromToken} on chain ${chainId}`;
        }
        if (!toTokenInfo) {
            throw `unknown token ${parameters.toToken} on chain ${chainId}`;
        }
        const fromAmount = parseUnits(parameters.fromAmount, fromTokenInfo.decimals);
        const pairs = await this.getLiquidityPairs(viemPublic, contracts, tokens);
        const tradePlan = await this.planSwap(pairs, fromTokenInfo, fromAmount, toTokenInfo);
        return {
            amount: formatUnits(tradePlan.quote, toTokenInfo.decimals),
            tokenPath: tradePlan.tokenPath.map((token) => token.symbol),
        };
    }

    @Tool({
        name: "plunderswap_swap",
        description: "Exchange the given tokens for another token.",
    })
    async swap(walletClient: ZilliqaWalletClientViemOnly, parameters: SwapParameters) {
        if (parameters.fromToken === parameters.toToken) {
            throw "tokens must differ";
        }
        const viemPublic = walletClient.getViemPublicClient();
        const viemWallet = walletClient.getViemWalletClient();
        const chainId = await viemPublic.getChainId();
        const contracts = getContractAddresses(chainId);
        await this.ensureTokens(chainId);
        const tokens = this.tokensByChain.get(chainId);
        if (!tokens) {
            throw `unknown chain ${chainId}`;
        }
        const fromTokenInfo = tokens.bySymbol.get(parameters.fromToken);
        const toTokenInfo = tokens.bySymbol.get(parameters.toToken);
        if (!fromTokenInfo) {
            throw `unknown token ${parameters.fromToken} on chain ${chainId}`;
        }
        if (!toTokenInfo) {
            throw `unknown token ${parameters.toToken} on chain ${chainId}`;
        }
        const fromAmount = parseUnits(parameters.fromAmount, fromTokenInfo.decimals);
        const toAmount = parseUnits(parameters.toAmount, toTokenInfo.decimals);
        const deadline = Math.round(parameters.deadline.getTime() / 1000);
        const pairs = await this.getLiquidityPairs(viemPublic, contracts, tokens);
        const tradePlan = await this.planSwap(pairs, fromTokenInfo, fromAmount, toTokenInfo);
        const txHashes: HexString[] = [];
        const approveTxHash = await this.ensureApproval(
            walletClient,
            tradePlan.tokenPath[0].address,
            contracts.router,
            fromAmount,
        );
        if (approveTxHash) {
            txHashes.push(approveTxHash);
        }
        const router = getContract({
            address: contracts.router,
            abi: this.routerAbi,
            client: {
                public: viemPublic,
                wallet: viemWallet,
            },
        });
        const tokenAddresses = tradePlan.tokenPath.map((token) => token.address);
        const [address] = await viemWallet.getAddresses();
        const swapTxHash = await router.write.swapExactTokensForTokens([
            fromAmount,
            toAmount,
            tokenAddresses,
            address,
            deadline,
        ]);
        txHashes.push(swapTxHash);
        await viemPublic.waitForTransactionReceipt({
            hash: swapTxHash,
        });
        return { txHashes };
    }

    @Tool({
        name: "plunderswap_zil_wrap",
        description: "Wrap native ZIL in an ERC-20 wrapper: change ZIL for WZIL.",
    })
    async wzil_deposit(walletClient: ZilliqaWalletClientViemOnly, parameters: WZilDepositParameters) {
        const viemPublic = walletClient.getViemPublicClient();
        const viemWallet = walletClient.getViemWalletClient();
        const chainId = await viemPublic.getChainId();
        await this.ensureTokens(chainId);
        const tokens = this.tokensByChain.get(chainId);
        if (!tokens) {
            throw `unknown chain ${chainId}`;
        }
        const wZilToken = tokens.bySymbol.get(WZIL_SYMBOL);
        if (!wZilToken) {
            throw `unknown token ${WZIL_SYMBOL} on chain ${chainId}`;
        }
        const amount = parseUnits(parameters.amount, wZilToken.decimals);
        const wZil = getContract({
            address: wZilToken.address,
            abi: this.wZilAbi,
            client: {
                public: viemPublic,
                wallet: viemWallet,
            },
        });
        const depositTxHash = await wZil.write.deposit([], { value: amount });
        await viemPublic.waitForTransactionReceipt({
            hash: depositTxHash,
        });
        return { txHash: depositTxHash };
    }

    @Tool({
        name: "plunderswap_zil_unwrap",
        description: "Unwrap native ZIL from an ERC-20 wrapper: change WZIL for ZIL.",
    })
    async wzil_withdraw(walletClient: ZilliqaWalletClientViemOnly, parameters: WZilWithdrawParameters) {
        const viemPublic = walletClient.getViemPublicClient();
        const viemWallet = walletClient.getViemWalletClient();
        const chainId = await viemPublic.getChainId();
        await this.ensureTokens(chainId);
        const tokens = this.tokensByChain.get(chainId);
        if (!tokens) {
            throw `unknown chain ${chainId}`;
        }
        const wZilToken = tokens.bySymbol.get(WZIL_SYMBOL);
        if (!wZilToken) {
            throw `unknown token ${WZIL_SYMBOL} on chain ${chainId}`;
        }
        const amount = parseUnits(parameters.amount, wZilToken.decimals);
        const wZil = getContract({
            address: wZilToken.address,
            abi: this.wZilAbi,
            client: {
                public: viemPublic,
                wallet: viemWallet,
            },
        });
        const withdrawTxHash = await wZil.write.withdraw([amount]);
        await viemPublic.waitForTransactionReceipt({
            hash: withdrawTxHash,
        });
        return { txHash: withdrawTxHash };
    }
}
