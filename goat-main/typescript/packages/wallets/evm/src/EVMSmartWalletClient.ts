import { EVMWalletClient } from "./EVMWalletClient";
import type { EVMTransaction } from "./types";

export abstract class EVMSmartWalletClient extends EVMWalletClient {
    abstract sendBatchOfTransactions(transactions: EVMTransaction[]): Promise<{ hash: string }>;
}
