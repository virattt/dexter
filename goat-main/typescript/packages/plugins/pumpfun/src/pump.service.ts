import { Tool } from "@goat-sdk/core";
import { SolanaWalletClient } from "@goat-sdk/wallet-solana";
import { Keypair, VersionedTransaction } from "@solana/web3.js";
import { CreateAndBuyTokenParameters } from "./parameters";

type CreateTokenMetadata = {
    name: string;
    symbol: string;
    description: string;
    imageUrl: string;
    twitter?: string;
    telegram?: string;
    website?: string;
};

export class PumpService {
    @Tool({
        description: "Create a token and buy it using pump.fun",
    })
    async createAndBuyToken(walletClient: SolanaWalletClient, parameters: CreateAndBuyTokenParameters) {
        const metadata = await this.createTokenMetadata({
            name: parameters.name,
            symbol: parameters.symbol,
            description: parameters.description,
            imageUrl: parameters.imageUrl,
        });

        const mint = Keypair.generate();

        const response = await fetch("https://pumpportal.fun/api/trade-local", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                publicKey: walletClient.getAddress(),
                action: "create",
                tokenMetadata: {
                    name: metadata.metadata.name,
                    symbol: metadata.metadata.symbol,
                    uri: metadata.metadataUri,
                },
                mint: mint.publicKey.toBase58(),
                denominatedInSol: "true",
                amount: parameters.amountToBuyInSol,
                slippage: parameters.slippage,
                priorityFee: parameters.priorityFee,
                pool: "pump",
            }),
        });

        if (response.status !== 200) {
            throw new Error(`Failed to create token: ${response.statusText}`);
        }

        const data = await response.arrayBuffer();
        const tx = VersionedTransaction.deserialize(new Uint8Array(data));

        const instructions = await walletClient.decompileVersionedTransactionToInstructions(tx);

        const { hash } = await walletClient.sendTransaction({
            instructions,
            accountsToSign: [mint],
        });

        return {
            hash,
            createdToken: mint.publicKey.toBase58(),
            creator: walletClient.getAddress(),
            url: `https://pump.fun/coin/${mint.publicKey.toBase58()}`,
        };
    }

    private async createTokenMetadata(create: CreateTokenMetadata) {
        // Download imageUrl and create file
        const image = await fetch(create.imageUrl).then((res) => res.blob());
        const file = new File([image], "image.png", { type: "image/png" });

        const formData = new FormData();
        formData.append("file", file);
        formData.append("name", create.name);
        formData.append("symbol", create.symbol);
        formData.append("description", create.description);
        formData.append("showName", "true");

        if (create.twitter) {
            formData.append("twitter", create.twitter);
        }
        if (create.telegram) {
            formData.append("telegram", create.telegram);
        }
        if (create.website) {
            formData.append("website", create.website);
        }
        const request = await fetch("https://pump.fun/api/ipfs", {
            method: "POST",
            body: formData,
        });
        return request.json();
    }
}
