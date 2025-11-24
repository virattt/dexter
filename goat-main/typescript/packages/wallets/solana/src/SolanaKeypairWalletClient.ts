import { type Keypair, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import nacl from "tweetnacl";
import { type SolanWalletClientCtorParams, SolanaWalletClient } from "./SolanaWalletClient";
import type { SolanaTransaction } from "./types";

export type SolanaKeypairWalletClientCtorParams = SolanWalletClientCtorParams & {
    keypair: Keypair;
};

export class SolanaKeypairWalletClient extends SolanaWalletClient {
    #keypair: Keypair;

    constructor(params: SolanaKeypairWalletClientCtorParams) {
        const { keypair, connection } = params;
        super({ connection });
        this.#keypair = keypair;
    }

    getAddress() {
        return this.#keypair.publicKey.toBase58();
    }

    async signMessage(message: string) {
        const messageBytes = Buffer.from(message);
        const signature = nacl.sign.detached(messageBytes, this.#keypair.secretKey);
        return {
            signature: Buffer.from(signature).toString("hex"),
        };
    }

    async sendTransaction({ instructions, addressLookupTableAddresses = [], accountsToSign = [] }: SolanaTransaction) {
        const latestBlockhash = await this.connection.getLatestBlockhash();

        const message = new TransactionMessage({
            payerKey: this.#keypair.publicKey,
            recentBlockhash: latestBlockhash.blockhash,
            instructions,
        }).compileToV0Message(await this.getAddressLookupTableAccounts(addressLookupTableAddresses));
        const transaction = new VersionedTransaction(message);

        transaction.sign([this.#keypair, ...accountsToSign]);

        const hash = await this.connection.sendTransaction(transaction, {
            maxRetries: 10,
            preflightCommitment: "confirmed",
        });

        await this.connection.confirmTransaction(
            {
                blockhash: latestBlockhash.blockhash,
                lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
                signature: hash,
            },
            "confirmed",
        );

        return {
            hash,
        };
    }

    async sendRawTransaction(transaction: string): Promise<{ hash: string }> {
        // The received transaction may be coming already signed, so we just need to deserialize it and counter-sign it.
        // If we were to modify the transaction in any way, we would invalidate the existing signature.
        const tx = VersionedTransaction.deserialize(Buffer.from(transaction, "base64"));

        const latestBlockhash = await this.connection.getLatestBlockhash();

        tx.sign([this.#keypair]);

        const hash = await this.connection.sendTransaction(tx, {
            maxRetries: 10,
            preflightCommitment: "confirmed",
        });

        await this.connection.confirmTransaction(
            {
                blockhash: latestBlockhash.blockhash,
                lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
                signature: hash,
            },
            "confirmed",
        );

        return {
            hash,
        };
    }
}

export const solana = (params: SolanaKeypairWalletClientCtorParams) => new SolanaKeypairWalletClient(params);
