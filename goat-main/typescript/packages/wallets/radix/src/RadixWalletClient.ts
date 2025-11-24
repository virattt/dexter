import { WalletClientBase } from "@goat-sdk/core";
import type { Chain } from "@goat-sdk/core";
import type { Balance, Signature } from "@goat-sdk/core";
import { Manifest, RadixWeb3Client, TransactionStatusResponse } from "radix-web3.js";

export type RadixWalletClientCtorParams = {
    accountAddress: string;
    client: RadixWeb3Client;
};

export class RadixWalletClient extends WalletClientBase {
    protected client: RadixWeb3Client;
    protected accountAddress: string;

    constructor(params: RadixWalletClientCtorParams) {
        super();
        this.client = params.client;
        this.accountAddress = params.accountAddress;
    }

    getChain(): Chain {
        return {
            type: "radix",
            id: this.client.networkClient.networkId,
        } as const;
    }

    getClient(): RadixWeb3Client {
        return this.client;
    }

    getAddress(): string {
        return this.accountAddress;
    }

    async signMessage(message: string): Promise<Signature> {
        return this.client.signMessage(message).then((signature) => ({ signature }));
    }

    async sendTransaction(manifest: Manifest): Promise<{ response: TransactionStatusResponse; transactionId: string }> {
        return this.client.submitTransaction(manifest).then(({ response, transactionId }) => ({
            response,
            transactionId,
        }));
    }

    async balanceOf(address: string): Promise<Balance> {
        const balance = await this.client.getBalances(address);
        const knownAddresses = await this.client.networkClient.getKnownAddresses();
        const xrdAddress = knownAddresses.resourceAddresses.xrd;
        const xrdBalance = balance.fungibleTokens.find((token) => token?.resourceAddress === xrdAddress)?.amount ?? "0";

        return {
            decimals: 18,
            symbol: "XRD",
            name: "Radix",
            value: xrdBalance,
            inBaseUnits: xrdBalance,
        };
    }
}
