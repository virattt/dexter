import type { Signature } from "@goat-sdk/core";
import { SuiClient } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { SuiWalletClient } from "./SuiWalletClient";
import type { SuiQuery, SuiReadResponse, SuiTransaction, TransactionResponse } from "./types";

export type SuiKeyPairWalletClientParams = {
    client: SuiClient;
    keypair: Ed25519Keypair;
};

export class SuiKeyPairWalletClient extends SuiWalletClient {
    private keypair: Ed25519Keypair;

    constructor(params: SuiKeyPairWalletClientParams) {
        super({ client: params.client });
        this.keypair = params.keypair;
    }

    /**
     * Send a transaction to the Sui network.
     * This method can handle any type of Sui transaction, including:
     * - Token transfers
     * - Smart contract interactions
     * - Object management
     * - Custom transaction blocks
     */
    async sendTransaction(transaction: SuiTransaction): Promise<TransactionResponse> {
        const result = await this.client.signAndExecuteTransaction({
            transaction: transaction.transaction,
            signer: this.keypair,
        });

        await this.client.waitForTransaction({
            digest: result.digest,
        });

        return { hash: result.digest };
    }

    async read(query: SuiQuery): Promise<SuiReadResponse> {
        // Use dynamic field or object read based on the query
        const result = await this.client.getObject({
            id: query.objectId,
            options: {
                showContent: true,
            },
        });

        return {
            value: result.data,
        };
    }

    getAddress(): string {
        return this.keypair.getPublicKey().toSuiAddress();
    }

    async signMessage(message: string): Promise<Signature> {
        const signatureArray = await this.keypair.sign(new TextEncoder().encode(message));
        const signature = Buffer.from(signatureArray).toString("base64");
        return { signature };
    }
}
