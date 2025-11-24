import { WalletClientBase } from "@goat-sdk/core";
import { Provider, TransactionRequest, formatUnits } from "fuels";

export type FuelWalletCtorParams = {
    provider: Provider;
};

export abstract class FuelWalletClient extends WalletClientBase {
    private provider: Provider;

    constructor(public readonly params: FuelWalletCtorParams) {
        super();
        this.provider = params.provider;
    }

    getChain() {
        return {
            type: "fuel",
        } as const;
    }

    getProvider() {
        return this.provider;
    }

    abstract sendTransaction(transaction: TransactionRequest): Promise<{ hash: string }>;

    abstract transfer(to: string, amount: string): Promise<{ hash: string }>;

    async balanceOf(address: string) {
        const balance = await this.provider.getBalance(address, this.provider.getBaseAssetId());

        return {
            decimals: 9,
            symbol: "ETH",
            name: "ETH",
            value: formatUnits(balance),
            inBaseUnits: balance.toString(),
        };
    }
}
