import { type DecompileArgs, TransactionMessage } from "@solana/web3.js";

import type { Connection, VersionedTransaction } from "@solana/web3.js";

export async function decompileVersionedTransactionToInstructions(
    connection: Connection,
    versionedTransaction: VersionedTransaction,
) {
    const lookupTableAddresses = versionedTransaction.message.addressTableLookups.map((lookup) => lookup.accountKey);
    const addressLookupTableAccounts = await Promise.all(
        lookupTableAddresses.map((address) =>
            connection.getAddressLookupTable(address).then((lookupTable) => lookupTable.value),
        ),
    );
    const nonNullAddressLookupTableAccounts = addressLookupTableAccounts.filter((lookupTable) => lookupTable != null);
    const decompileArgs: DecompileArgs = {
        addressLookupTableAccounts: nonNullAddressLookupTableAccounts,
    };
    return TransactionMessage.decompile(versionedTransaction.message, decompileArgs).instructions;
}
