export interface ConfigSchema {
    base_url: string;
    Starknet_rpc: string;
    private_key: string;
    account_address: string;
}

export interface GetQuoteBodySchema {
    sellTokenAddress: string;
    buyTokenAddress: string;
    sellAmount: bigint;
    takerAddress: string;
    size: number;
}
