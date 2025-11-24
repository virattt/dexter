export interface BalanceServiceParams {
    baseUrl?: string;
    apiKey?: string;
}

export interface TokenBalance {
    balance: string;
    allowance: string;
}

export interface AggregatedBalancesAndAllowancesResponse {
    [tokenAddress: string]: TokenBalance;
}
