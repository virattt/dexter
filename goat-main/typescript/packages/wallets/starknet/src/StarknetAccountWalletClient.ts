import type { Account } from "starknet";
import { type StarknetTransaction, StarknetWalletClient, type StarknetWalletCtorParams } from "./StarknetWalletClient";

export type StarknetAccountWalletCtorParams = StarknetWalletCtorParams & {
    starknetAccount: Account;
};

export class StarknetAccountWalletClient extends StarknetWalletClient {
    private starknetAccount: Account;

    constructor(params: StarknetAccountWalletCtorParams) {
        super({ starknetClient: params.starknetClient });
        this.starknetAccount = params.starknetAccount;
    }

    getAddress() {
        return this.starknetAccount.address;
    }

    async signMessage(message: string) {
        try {
            const signature = await this.starknetAccount.signMessage({
                domain: {
                    name: "StarkNet",
                    chainId: "SN_MAIN",
                    version: "1",
                },
                types: {
                    Message: [{ name: "message", type: "felt" }],
                },
                primaryType: "Message",
                message: { message },
            });
            return {
                signature: signature.toString(),
            };
        } catch (error) {
            throw new Error(`Signing message failed: ${error}`);
        }
    }

    async sendTransaction({ calls, transactionDetails }: StarknetTransaction) {
        try {
            const result = await this.starknetAccount.execute(calls, undefined, {
                maxFee: transactionDetails?.maxFee,
                version: transactionDetails?.version,
                nonce: transactionDetails?.nonce,
                resourceBounds: transactionDetails?.resourceBounds,
            });

            const receipt = await this.starknetClient.waitForTransaction(result.transaction_hash, {
                retryInterval: 1000,
            });

            if (!receipt.isSuccess()) {
                throw new Error("Transaction failed");
            }

            return {
                hash: receipt.transaction_hash,
            };
        } catch (error) {
            throw new Error(`Transaction failed: ${error}`);
        }
    }

    getAccount(): Account {
        return this.starknetAccount;
    }
}

export function starknet({ starknetAccount, starknetClient }: StarknetAccountWalletCtorParams) {
    return new StarknetAccountWalletClient({ starknetAccount, starknetClient });
}
