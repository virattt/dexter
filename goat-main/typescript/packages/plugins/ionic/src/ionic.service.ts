import { Tool } from "@goat-sdk/core";
import { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { type Address, formatUnits, parseUnits } from "viem";
import { cerc20DelegatorAbi } from "./abis";
import { ComptrollerProxyAbi } from "./abis/ComptrollerProxyAbi";
import { poolAbi } from "./abis/Pool";
import { ionicProtocolAddresses } from "./ionic.config";
import {
    BorrowAssetParameters,
    GetHealthMetricsParameters,
    LoopAssetParameters,
    SupplyAssetParameters,
    SwapCollateralParameters,
} from "./parameters";
import type { HealthMetrics } from "./types";

export class IonicService {
    private async getAssetConfig(chainId: number, symbol: string): Promise<{ address: Address; decimals: number }> {
        const config = ionicProtocolAddresses[chainId]?.assets?.[symbol];
        if (!config?.address || config.decimals === undefined) {
            throw new Error(`Asset ${symbol} not found in Ionic Protocol addresses for chain ${chainId}`);
        }
        return { address: config.address as Address, decimals: config.decimals };
    }

    @Tool({
        name: "ionic_supply_asset",
        description: "Supply an asset to an Ionic Protocol pool. Make sure to approve the pool first.",
    })
    async supplyAsset(wallet: EVMWalletClient, params: SupplyAssetParameters): Promise<string> {
        const { asset, amount } = params;
        const chain = wallet.getChain();

        // Get token address from config
        const tokenAddress = ionicProtocolAddresses[chain.id]?.assets?.[asset]?.address;
        if (!tokenAddress) {
            throw new Error(`Token address not found for ${asset} on chain ${chain.id}`);
        }

        // Then supply to pool
        const txn = await wallet.sendTransaction({
            to: tokenAddress,
            abi: poolAbi,
            functionName: "mint",
            args: [BigInt(amount)],
        });

        return txn.hash;
    }

    @Tool({
        name: "ionic_borrow_asset",
        description: "Borrow an asset from an Ionic Protocol pool",
    })
    async borrowAsset(wallet: EVMWalletClient, params: BorrowAssetParameters): Promise<string> {
        const { asset, amount } = params;
        const chain = await wallet.getChain();
        const { address } = await this.getAssetConfig(chain.id, asset);

        const comptrollerAddress = ionicProtocolAddresses[chain.id]?.Comptroller;
        if (!comptrollerAddress) throw new Error("Comptroller not found");

        const tokenAddress = ionicProtocolAddresses[chain.id]?.assets?.[asset]?.address;
        if (!tokenAddress) {
            throw new Error(`Token address not found for ${asset} on chain ${chain.id}`);
        }

        // Check borrow allowed
        const borrowAllowed = await wallet.read({
            address: comptrollerAddress,
            abi: ComptrollerProxyAbi,
            functionName: "borrowAllowed",
            args: [address, wallet.getAddress(), amount],
        });

        if (borrowAllowed.toString() !== "0") {
            throw new Error(`Borrow not allowed: ${borrowAllowed}`);
        }

        // Execute borrow
        const txn = await wallet.sendTransaction({
            to: tokenAddress,
            abi: poolAbi,
            functionName: "borrow",
            args: [amount],
        });

        return txn.hash;
    }

    @Tool({
        name: "ionic_get_health_metrics",
        description: "Get health metrics for an Ionic Protocol position including LTV and liquidation risk",
    })
    async getHealthMetrics(wallet: EVMWalletClient, params: GetHealthMetricsParameters): Promise<HealthMetrics> {
        try {
            const chain = wallet.getChain();
            const userAddress = wallet.getAddress();

            // Get Comptroller contract
            const comptrollerAddress = ionicProtocolAddresses[chain.id]?.Comptroller;
            if (!comptrollerAddress) throw new Error("Comptroller not found");

            // Get account liquidity info
            const result = await wallet.read({
                address: comptrollerAddress,
                abi: ComptrollerProxyAbi,
                functionName: "getAccountLiquidity",
                args: [userAddress],
            });

            const accountLiquidity = (result as { value: [bigint, bigint, bigint, bigint] }).value;

            const [errorCode, collateralValue, liquidity, shortfall] = accountLiquidity;

            if (errorCode.toString() !== "0") {
                throw new Error(`Error getting account liquidity: ${errorCode}`);
            }

            // Calculate health factor using BigInt arithmetic
            let healthFactor = "∞"; // Default value when there's no borrow
            if (collateralValue > 0n && collateralValue - liquidity > 0n) {
                // Convert to number after calculation to avoid precision loss
                const healthFactorBig = (collateralValue * 10000n) / (collateralValue - liquidity);
                healthFactor = (Number(healthFactorBig) / 10000).toString();
            }

            // Get all markets user is in
            const assetsResult = await wallet.read({
                address: comptrollerAddress,
                abi: ComptrollerProxyAbi,
                functionName: "getAssetsIn",
                args: [userAddress],
            });
            const assets = (assetsResult as { value: Address[] }).value;

            let totalSuppliedUSD = 0n;
            let totalBorrowedUSD = 0n;

            for (const asset of assets) {
                const supplyBalanceResult = await wallet.read({
                    address: asset,
                    abi: cerc20DelegatorAbi,
                    functionName: "balanceOf",
                    args: [userAddress],
                });
                const supplyBalance = (supplyBalanceResult as { value: bigint }).value;

                // Get exchange rate to convert cToken balance to underlying
                const exchangeRateResult = await wallet.read({
                    address: asset,
                    abi: cerc20DelegatorAbi,
                    functionName: "exchangeRateCurrent",
                });
                const exchangeRate = (exchangeRateResult as { value: bigint }).value;

                const actualSupplyBalance = (supplyBalance * exchangeRate) / parseUnits("1", 18);

                const borrowBalanceResult = await wallet.read({
                    address: asset,
                    abi: cerc20DelegatorAbi,
                    functionName: "borrowBalanceCurrent",
                    args: [userAddress],
                });

                const borrowBalance = (borrowBalanceResult as { value: bigint }).value;

                // Calculate USD values using the formatted price
                const SuppliedUSD = Number(formatUnits(actualSupplyBalance, 18));
                const BorrowedUSD = Number(formatUnits(borrowBalance, 18));

                // Convert back to BigInt with proper scaling
                totalSuppliedUSD += SuppliedUSD !== 0 ? BigInt(Math.floor(SuppliedUSD * 1e18)) : 0n;
                totalBorrowedUSD += BorrowedUSD !== 0 ? BigInt(Math.floor(BorrowedUSD * 1e18)) : 0n;
            }

            // Calculate LTV using BigInt arithmetic
            let ltvString = "0";
            if (totalSuppliedUSD > 0n) {
                const ltvBig = (totalBorrowedUSD * parseUnits("1", 18)) / totalSuppliedUSD;
                ltvString = formatUnits(ltvBig, 18);
            }

            return {
                totalSuppliedUSD: formatUnits(totalSuppliedUSD, 6),
                totalBorrowedUSD: formatUnits(totalBorrowedUSD, 18),
                ltv: ltvString,
                liquidity: formatUnits(liquidity, 18),
                shortfall: formatUnits(shortfall, 18),
                healthFactor: healthFactor,
            };
        } catch (error) {
            throw new Error(`Failed to get health metrics: ${error}`);
        }
    }

    @Tool({
        name: "ionic_loop_asset",
        description: "Loop (leverage) an asset position in Ionic Protocol",
    })
    async loopAsset(wallet: EVMWalletClient, params: LoopAssetParameters) {
        try {
            const { asset, initialAmount, targetltv, maxIterations } = params;
            const chain = wallet.getChain();
            const { address: assetAddress } = await this.getAssetConfig(chain.id, asset);

            // Get Comptroller contract
            const comptrollerAddress = ionicProtocolAddresses[chain.id]?.Comptroller;
            if (!comptrollerAddress) throw new Error("Comptroller not found");

            // Enter markets first to enable collateral
            const enterMarketsTx = await wallet.sendTransaction({
                to: comptrollerAddress,
                abi: ComptrollerProxyAbi,
                functionName: "enterMarkets",
                args: [[assetAddress]],
            });

            // Initial supply
            const initialSupplyTx = await wallet.sendTransaction({
                to: assetAddress,
                abi: cerc20DelegatorAbi,
                functionName: "mint",
                args: [BigInt(initialAmount)],
            });

            let currentAmount = BigInt(initialAmount);
            const targetLTV = parseUnits(targetltv, 18);
            const iterations = maxIterations || 5;

            for (let i = 0; i < iterations; i++) {
                // Check if target LTV reached
                const metrics = await this.getHealthMetrics(wallet, {});
                const currentLTV = parseUnits(metrics.ltv, 18);

                if (currentLTV >= targetLTV) {
                    // target ltv reached , stop looping
                    break;
                }

                // Calculate borrow amount based on target LTV
                const borrowAmount = (currentAmount * targetLTV) / parseUnits("1.0", 18);

                // Borrow
                await wallet.sendTransaction({
                    to: assetAddress,
                    abi: cerc20DelegatorAbi,
                    functionName: "borrow",
                    args: [borrowAmount],
                });

                // Supply borrowed amount
                await wallet.sendTransaction({
                    to: assetAddress,
                    abi: cerc20DelegatorAbi,
                    functionName: "mint",
                    args: [borrowAmount],
                });

                currentAmount = borrowAmount;
            }

            return {
                initialSupplyTx: initialSupplyTx.hash,
                enterMarketsTx: enterMarketsTx.hash,
                iterations: iterations,
                currentAmount: formatUnits(currentAmount, 18),
            };
        } catch (error) {
            throw new Error(`Failed to loop asset: ${error}`);
        }
    }

    @Tool({
        name: "ionic_swap_collateral",
        description: "Swap one collateral asset for another while maintaining borrow position",
    })
    async swapCollateral(wallet: EVMWalletClient, params: SwapCollateralParameters) {
        const { fromAsset, toAsset, amount } = params;
        const chain = wallet.getChain();

        // First withdraw the collateral
        const fromAssetConfig = await this.getAssetConfig(chain.id, fromAsset);

        // Withdraw collateral
        const pool = await wallet.sendTransaction({
            to: fromAssetConfig.address,
            abi: poolAbi,
            functionName: "redeemUnderlying",
            args: [BigInt(amount)],
        });

        const supplynewcollateral = await wallet.sendTransaction({
            to: fromAssetConfig.address,
            abi: poolAbi,
            functionName: "supplyAsset",
            args: [toAsset, amount],
        });

        return {
            poolTx: pool.hash,
            supplyNewCollateralTx: supplynewcollateral.hash,
        };
    }
}
