export interface HealthMetrics {
    totalSuppliedUSD: string;
    totalBorrowedUSD: string;
    ltv: string;
    liquidity: string;
    shortfall: string;
    healthFactor: string;
}

export interface LoopingConfig {
    maxLeverage: number;
    supportedAssets: string[];
    minCollateralUSD: number;
}

export interface SupplyPosition {
    asset: string;
    amount: string;
    value: string;
    apy: number;
}

export interface CollateralSwapConfig {
    slippageTolerance: number;
    maxSwapSize: number;
}

export interface BorrowPosition {
    asset: string;
    amount: string;
    value: string;
    apy: number;
    collateral: boolean;
}

export interface PoolAsset {
    symbol: string;
    decimals: number;
    totalSupply: bigint;
    totalSupplyUSD: bigint;
    totalBorrowUSD: bigint;
    supplyAPY: bigint;
    utilization: bigint;
}

export interface PoolData {
    assets: PoolAsset[];
}

export interface PortfolioHealth {
    totalBorrowUSD: string;
    totalCollateralUSD: string;
    healthFactor: string;
    ltv: string;
    liquidationRisk: "LOW" | "MEDIUM" | "HIGH";
    positions: {
        asset: string;
        supplyBalanceUSD: string;
        borrowBalanceUSD: string;
        supplyAPY: number;
        borrowAPY: number;
    }[];
}
