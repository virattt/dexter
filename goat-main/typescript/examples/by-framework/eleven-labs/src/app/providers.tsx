"use client";

import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { DynamicContextProvider } from "@dynamic-labs/sdk-react-core";
import { SolanaWalletConnectors } from "@dynamic-labs/solana";

export const Web3Provider = ({ children }: { children: React.ReactNode }) => {
    return (
        <DynamicContextProvider
            settings={{
                environmentId: "f268a013-0fa0-4d9d-9314-c6919e2dfde7", // TODO replace in prod
                walletConnectors: [EthereumWalletConnectors, SolanaWalletConnectors],
            }}
        >
            {children}
        </DynamicContextProvider>
    );
};
