import type { Connection, PublicKey } from "@solana/web3.js";

/**
 * Checks if a Solana account exists by fetching its info.
 * @param connection The Solana connection object.
 * @param address The public key of the account to check.
 * @returns True if the account exists, false otherwise.
 */
export async function doesAccountExist(connection: Connection, address: PublicKey): Promise<boolean> {
    const account = await connection.getAccountInfo(address);
    return account != null;
}
