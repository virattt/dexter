import type { EVMWalletClient } from "@goat-sdk/wallet-evm";
import type { SolanaWalletClient } from "@goat-sdk/wallet-solana";

import { createEVMWallet } from "./evm";
import { createSolanaWallet } from "./solana";
import type { LitEVMWalletOptions, LitSolanaWalletOptions } from "./types";

export function lit(options: LitEVMWalletOptions): EVMWalletClient;
export function lit(options: LitSolanaWalletOptions): SolanaWalletClient;
export function lit(options: LitEVMWalletOptions | LitSolanaWalletOptions): EVMWalletClient | SolanaWalletClient {
    if (options.network === "evm") {
        return createEVMWallet(options);
    }

    return createSolanaWallet(options);
}

export * from "./setup";
