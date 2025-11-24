import { WalletClientBase } from "@goat-sdk/core";
import type { Chain } from "@goat-sdk/core";
import type { Balance, Signature } from "@goat-sdk/core";
import { type SuiClient } from "@mysten/sui/client";

import type {
    SuiQuery,
    SuiReadResponse,
    SuiTransaction,
    SuiWalletClientCtorParams,
    TransactionResponse,
} from "./types";

export abstract class SuiWalletClient extends WalletClientBase {
    protected client: SuiClient;

    constructor(params: SuiWalletClientCtorParams) {
        super();
        this.client = params.client;
    }

    getChain(): Chain {
        return {
            type: "sui",
        } as const;
    }

    getClient() {
        return this.client;
    }

    abstract getAddress(): string;

    abstract signMessage(message: string): Promise<Signature>;

    abstract sendTransaction(transaction: SuiTransaction): Promise<TransactionResponse>;

    abstract read(query: SuiQuery): Promise<SuiReadResponse>;

    async balanceOf(address: string): Promise<Balance> {
        const balance = await this.client.getBalance({
            owner: address,
        });

        return {
            decimals: 9,
            symbol: "SUI",
            name: "Sui",
            value: balance.totalBalance,
            inBaseUnits: balance.totalBalance,
        };
    }
}
