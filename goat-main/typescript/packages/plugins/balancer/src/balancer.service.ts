import {
    AddLiquidity,
    AddLiquidityInput,
    AddLiquidityKind,
    BALANCER_BATCH_ROUTER,
    BALANCER_ROUTER,
    BalancerApi,
    ChainId,
    ExactInQueryOutput,
    InputAmount,
    MaxSigDeadline,
    PERMIT2,
    PermitDetails,
    RemoveLiquidity,
    RemoveLiquidityInput,
    RemoveLiquidityKind,
    Slippage,
    Swap,
    SwapBuildCallInput,
    SwapBuildOutputExactIn,
    SwapKind,
    Token,
    TokenAmount,
    erc20Abi,
    permit2Abi,
} from "@balancer/sdk";
import { Tool } from "@goat-sdk/core";
import { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { BalancerConfig } from "./balancer.plugin";
import { LiquidityParameters, RemoveLiquidityParameters, SwapParameters } from "./parameters";

export class BalancerService {
    private rpcUrl: string;
    private apiUrl: string;

    constructor(config: BalancerConfig) {
        this.rpcUrl = config.rpcUrl;
        this.apiUrl = config.apiUrl ?? "https://api-v3.balancer.fi/";
    }

    private getBalancerApi(chainId: ChainId) {
        return new BalancerApi(this.apiUrl, chainId);
    }

    @Tool({
        name: "swap_on_balancer",
        description: "Swap a token on Balancer using Smart Order Router",
    })
    async swapOnBalancer(walletClient: EVMWalletClient, parameters: SwapParameters) {
        const chainId = walletClient.getChain().id as ChainId;
        const balancerApi = this.getBalancerApi(chainId);

        const tokenIn = new Token(chainId, parameters.tokenIn as `0x${string}`, parameters.tokenInDecimals);
        const tokenOut = new Token(chainId, parameters.tokenOut as `0x${string}`, parameters.tokenOutDecimals);
        const swapAmount = TokenAmount.fromRawAmount(tokenIn, parameters.amountIn);
        const deadline = parameters.deadline
            ? BigInt(Math.floor(Date.now() / 1000) + (parameters.deadline || 3600))
            : 999999999999999999n; // Infinite deadline if not provided

        const sorPaths = await balancerApi.sorSwapPaths.fetchSorSwapPaths({
            chainId,
            tokenIn: tokenIn.address,
            tokenOut: tokenOut.address,
            swapKind: SwapKind.GivenIn,
            swapAmount,
            useProtocolVersion: 3,
        });

        const swap = new Swap({
            chainId,
            paths: sorPaths,
            swapKind: SwapKind.GivenIn,
        });

        const queryOutput = (await swap.query(this.rpcUrl)) as ExactInQueryOutput;

        const slippage = Slippage.fromPercentage(`${Number(parameters.slippage)}`);
        const wethIsEth = parameters.wethIsEth ?? false;

        // Check if Permit2 is approved
        const allowance = await walletClient.read({
            address: tokenIn.address,
            abi: erc20Abi,
            functionName: "allowance",
            args: [walletClient.getAddress() as `0x${string}`, PERMIT2[chainId]],
        });

        if (BigInt(allowance.value as string) < BigInt(parameters.amountIn)) {
            await walletClient.sendTransaction({
                to: tokenIn.address,
                abi: erc20Abi,
                functionName: "approve",
                args: [PERMIT2[chainId], parameters.amountIn],
            });
        }

        const swapBuildCallInput: SwapBuildCallInput = {
            sender: walletClient.getAddress() as `0x${string}`,
            recipient: walletClient.getAddress() as `0x${string}`,
            slippage,
            deadline,
            wethIsEth,
            queryOutput,
        };

        // Sign Permit2
        const maxAmountIn = queryOutput.amountIn;

        const spender = queryOutput.pathAmounts ? BALANCER_BATCH_ROUTER[chainId] : BALANCER_ROUTER[chainId];

        const nonceQuery = await walletClient.read({
            abi: permit2Abi,
            address: PERMIT2[chainId],
            functionName: "allowance",
            args: [walletClient.getAddress() as `0x${string}`, tokenIn.address, spender],
        });

        const details: PermitDetails = {
            token: tokenIn.address,
            amount: maxAmountIn.amount,
            expiration: Number(deadline),
            nonce: (nonceQuery.value as [number, number, number])[2],
        };

        const batch = {
            details: [details],
            spender,
            sigDeadline: MaxSigDeadline,
        };

        const PERMIT2_DOMAIN_NAME = "Permit2";
        const domain = {
            name: PERMIT2_DOMAIN_NAME,
            chainId,
            verifyingContract: PERMIT2[chainId],
        };

        const permitData = {
            domain,
            types: {
                PermitDetails: [
                    { name: "token", type: "address" },
                    { name: "amount", type: "uint160" },
                    { name: "expiration", type: "uint48" },
                    { name: "nonce", type: "uint48" },
                ],
                PermitBatch: [
                    { name: "details", type: "PermitDetails[]" },
                    { name: "spender", type: "address" },
                    { name: "sigDeadline", type: "uint256" },
                ],
            },
            primaryType: "PermitBatch",
            values: batch,
        };

        const signature = await walletClient.signTypedData({
            domain,
            types: permitData.types,
            primaryType: permitData.primaryType,
            message: permitData.values,
        });

        const callData = swap.buildCallWithPermit2(swapBuildCallInput, {
            signature: signature.signature as `0x${string}`,
            batch,
        }) as SwapBuildOutputExactIn;

        const tx = await walletClient.sendTransaction({
            to: callData.to as `0x${string}`,
            value: callData.value,
            data: callData.callData,
        });

        return {
            success: true,
            data: {
                amountOut: callData.minAmountOut.amount.toString(),
                txHash: tx.hash,
            },
        };
    }

    @Tool({
        name: "add_liquidity_to_balancer",
        description: "Add liquidity to a Balancer pool",
    })
    async addLiquidity(walletClient: EVMWalletClient, parameters: LiquidityParameters) {
        const chainId = walletClient.getChain().id as ChainId;
        const balancerApi = this.getBalancerApi(chainId);

        const poolState = await balancerApi.pools.fetchPoolState(parameters.pool as `0x${string}`);

        const amountsIn = parameters.amounts.map((amount: { amount: string; decimals: number; token: string }) => ({
            rawAmount: BigInt(amount.amount),
            decimals: amount.decimals,
            address: amount.token as `0x${string}`,
        }));

        const addLiquidityInput: AddLiquidityInput = {
            chainId,
            rpcUrl: this.rpcUrl,
            amountsIn,
            kind: AddLiquidityKind.Unbalanced,
        };

        const addLiquidity = new AddLiquidity();
        const queryOutput = await addLiquidity.query(addLiquidityInput, poolState);

        const call = addLiquidity.buildCall({
            ...queryOutput,
            slippage: Slippage.fromPercentage(`${Number(parameters.slippage)}`),
            chainId,
            wethIsEth: parameters.wethIsEth ?? false,
        });

        const tx = await walletClient.sendTransaction({
            to: call.to as `0x${string}`,
            value: call.value,
            data: call.callData,
        });

        return {
            success: true,
            data: {
                bptOut: queryOutput.bptOut.amount.toString(),
                txHash: tx.hash,
            },
        };
    }

    @Tool({
        name: "remove_liquidity_from_balancer",
        description: "Remove liquidity from a Balancer pool proportionally",
    })
    async removeLiquidity(walletClient: EVMWalletClient, parameters: RemoveLiquidityParameters) {
        const chainId = walletClient.getChain().id as ChainId;
        const balancerApi = this.getBalancerApi(chainId);

        const poolState = await balancerApi.pools.fetchPoolState(parameters.pool as `0x${string}`);

        const bptIn: InputAmount = {
            rawAmount: BigInt(parameters.bptAmountIn),
            decimals: 18, // BPT tokens always have 18 decimals
            address: poolState.address,
        };

        const removeLiquidityInput: RemoveLiquidityInput = {
            chainId,
            rpcUrl: this.rpcUrl,
            bptIn,
            kind: RemoveLiquidityKind.Proportional,
        };

        const removeLiquidity = new RemoveLiquidity();
        const queryOutput = await removeLiquidity.query(removeLiquidityInput, poolState);

        const call = removeLiquidity.buildCall({
            ...queryOutput,
            slippage: Slippage.fromPercentage(`${Number(parameters.slippage)}`),
            chainId,
            wethIsEth: parameters.wethIsEth ?? false,
        });

        const tx = await walletClient.sendTransaction({
            to: call.to as `0x${string}`,
            value: call.value,
            data: call.callData,
        });

        return {
            success: true,
            data: {
                amountsOut: queryOutput.amountsOut.map((amount) => ({
                    token: amount.token.address,
                    amount: amount.amount.toString(),
                })),
                txHash: tx.hash,
            },
        };
    }
}
