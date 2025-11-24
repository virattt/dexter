import { LitNodeClient } from "@lit-protocol/lit-node-client";
import type { SessionSigsMap } from "@lit-protocol/types";
import { StoredKeyData, api } from "@lit-protocol/wrapped-keys";
import { PublicKey, Transaction } from "@solana/web3.js";

import { type SolanaTransaction, SolanaWalletClient } from "@goat-sdk/wallet-solana";
import { formatUnits } from "viem";
import type { LitSolanaWalletOptions } from "./types";

const { signMessageWithEncryptedKey, signTransactionWithEncryptedKey } = api;

export class LitSolanaWallet extends SolanaWalletClient {
    private litNodeClient: LitNodeClient;
    private pkpSessionSigs: SessionSigsMap;
    private wrappedKeyMetadata: StoredKeyData & { wrappedKeyAddress: string };
    private chain: "devnet" | "mainnet-beta" | "testnet";

    constructor(options: LitSolanaWalletOptions) {
        super({ connection: options.connection });
        const { litNodeClient, pkpSessionSigs, wrappedKeyMetadata, chain } = options;
        this.litNodeClient = litNodeClient;
        this.pkpSessionSigs = pkpSessionSigs;
        this.wrappedKeyMetadata = wrappedKeyMetadata;
        this.chain = chain;
    }

    getAddress(): string {
        return this.wrappedKeyMetadata.publicKey;
    }

    async signMessage(message: string): Promise<{ signature: string }> {
        const signature = await signMessageWithEncryptedKey({
            pkpSessionSigs: this.pkpSessionSigs,
            network: "solana",
            id: this.wrappedKeyMetadata.id,
            messageToSign: message,
            litNodeClient: this.litNodeClient,
        });

        return { signature };
    }

    async sendTransaction({ instructions }: SolanaTransaction): Promise<{ hash: string }> {
        const latestBlockhash = await this.connection.getLatestBlockhash("confirmed");
        const tx = new Transaction();
        tx.recentBlockhash = latestBlockhash.blockhash;
        tx.feePayer = new PublicKey(this.wrappedKeyMetadata.publicKey);
        tx.add(...instructions);

        const serializedTransaction = tx
            .serialize({
                requireAllSignatures: false,
                verifySignatures: false,
            })
            .toString("base64");

        const litTransaction = {
            serializedTransaction,
            chain: this.chain,
        };

        const signedTransaction = await signTransactionWithEncryptedKey({
            litNodeClient: this.litNodeClient,
            pkpSessionSigs: this.pkpSessionSigs,
            network: "solana",
            id: this.wrappedKeyMetadata.id,
            unsignedTransaction: litTransaction,
            broadcast: true,
        });

        return {
            hash: signedTransaction,
        };
    }

    async sendRawTransaction(transaction: string): Promise<{ hash: string }> {
        const litTransaction = {
            serializedTransaction: transaction,
            chain: this.chain,
        };

        const signedTransaction = await signTransactionWithEncryptedKey({
            litNodeClient: this.litNodeClient,
            pkpSessionSigs: this.pkpSessionSigs,
            network: "solana",
            id: this.wrappedKeyMetadata.id,
            unsignedTransaction: litTransaction,
            broadcast: true,
        });

        return {
            hash: signedTransaction,
        };
    }

    async balanceOf(address: string) {
        const pubkey = new PublicKey(address);
        const balance = await this.connection.getBalance(pubkey);

        return {
            decimals: 9,
            symbol: "SOL",
            name: "Solana",
            value: formatUnits(BigInt(balance), 9),
            inBaseUnits: balance.toString(),
        };
    }
}

export function createSolanaWallet(options: LitSolanaWalletOptions) {
    return new LitSolanaWallet(options);
}
