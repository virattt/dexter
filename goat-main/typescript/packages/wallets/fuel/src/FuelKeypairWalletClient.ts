import { Provider, TransactionRequest, Wallet, WalletUnlocked, bn } from "fuels";
import { FuelWalletClient } from "./FuelWalletClient";

export type FuelKeypairWalletClientCtorParams = {
    privateKey: string;
    provider: Provider;
};

export class FuelKeypairWalletClient extends FuelWalletClient {
    wallet: WalletUnlocked;

    constructor(public readonly params: FuelKeypairWalletClientCtorParams) {
        const { privateKey, provider } = params;
        super({ provider });
        this.wallet = Wallet.fromPrivateKey(privateKey, provider);
    }

    getAddress() {
        return this.wallet.address.toB256();
    }

    async signMessage(message: string) {
        const signature = (await this.wallet.signMessage(message)).toString();
        return {
            signature,
        };
    }

    async transfer(to: string, amount: string) {
        const amountInWei = bn.parseUnits(amount);

        const tx = await this.wallet.transfer(to, amountInWei);
        const { id } = await tx.waitForResult();
        return {
            hash: id,
        };
    }

    async sendTransaction(transaction: TransactionRequest) {
        const tx = await this.wallet.sendTransaction(transaction);
        const { id } = await tx.waitForResult();
        return {
            hash: id,
        };
    }
}

export function fuel({ privateKey, provider }: FuelKeypairWalletClientCtorParams) {
    return new FuelKeypairWalletClient({ privateKey, provider });
}
