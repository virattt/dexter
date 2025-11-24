import { SuiClient } from "@mysten/sui/client";
import { type Transaction } from "@mysten/sui/transactions";

export type SuiReadResponse = {
    value: unknown;
};

export type SuiTransaction = {
    transaction: Transaction;
};

export type TransactionResponse = {
    hash: string;
};

export type SuiQuery = {
    objectId: string;
};

export type SuiWalletClientCtorParams = {
    client: SuiClient;
};
