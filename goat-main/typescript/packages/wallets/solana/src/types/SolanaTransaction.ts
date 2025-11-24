import type { Keypair, TransactionInstruction } from "@solana/web3.js";

export type SolanaTransaction = SolanaInstructionTransaction;

export type SolanaInstructionTransaction = {
    instructions: TransactionInstruction[];
    addressLookupTableAddresses?: string[];
    accountsToSign?: Keypair[];
    signer?: Keypair;
};
