import type { Account, Aptos } from "@aptos-labs/ts-sdk";
import { WalletClientBase } from "@goat-sdk/core";
import { formatUnits } from "viem";
import type { AptosReadRequest } from "./types/AptosReadRequest";
import type { AptosTransaction } from "./types/AptosTransaction";

export type AptosWalletCtorParams = {
    aptosAccount: Account;
    aptosClient: Aptos;
};

export class AptosWalletClient extends WalletClientBase {
    private aptosAccount: Account;
    aptosClient: Aptos;

    constructor(params: AptosWalletCtorParams) {
        super();
        this.aptosAccount = params.aptosAccount;
        this.aptosClient = params.aptosClient;
    }

    getAddress() {
        return this.aptosAccount.accountAddress.toStringLong();
    }

    getChain() {
        return {
            type: "aptos",
        } as const;
    }

    async signMessage(message: string) {
        const signature = this.aptosAccount.sign(message).toString();
        return {
            signature,
        };
    }

    async sendTransaction({ transactionData }: AptosTransaction) {
        const transaction = await this.aptosClient.transaction.build.simple({
            sender: this.aptosAccount.accountAddress,
            data: transactionData,
        });
        const response = await this.aptosClient
            .signAndSubmitTransaction({
                signer: this.aptosAccount,
                transaction,
            })
            .then((tx) => this.aptosClient.waitForTransaction({ transactionHash: tx.hash }));
        return {
            hash: response.hash,
        };
    }

    async read({ viewFunctionData, ledgerVersionArg }: AptosReadRequest) {
        const value = await this.aptosClient.view({
            payload: viewFunctionData,
            options: ledgerVersionArg,
        });
        return {
            value,
        };
    }

    async balanceOf(address: string) {
        const balance = await this.aptosClient.getAccountAPTAmount({
            accountAddress: address,
        });

        return {
            decimals: 8,
            symbol: "APT",
            name: "Aptos",
            value: formatUnits(BigInt(balance), 8),
            inBaseUnits: balance.toString(),
        };
    }
}

export function aptos({ aptosAccount, aptosClient }: AptosWalletCtorParams) {
    return new AptosWalletClient({ aptosAccount, aptosClient });
}
