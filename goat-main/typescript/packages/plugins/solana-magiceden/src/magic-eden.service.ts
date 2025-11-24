import { Tool } from "@goat-sdk/core";
import { SolanaWalletClient } from "@goat-sdk/wallet-solana";
import { VersionedTransaction } from "@solana/web3.js";
import type { z } from "zod";
import {
    GetNftInfoParametersSchema,
    getBuyListingTransactionResponseSchema,
    getNftInfoResponseSchema,
} from "./parameters";

export class MagicEdenService {
    constructor(private readonly apiKey?: string) {}

    @Tool({
        description: "Get information about an NFT from the Magic Eden API",
    })
    async getNftListings(parameters: GetNftInfoParametersSchema) {
        let nftInfo: z.infer<typeof getNftInfoResponseSchema>;
        try {
            const response = await fetch(
                `https://api-mainnet.magiceden.dev/v2/tokens/${parameters.mintHash}/listings
    `,
                {
                    headers: {
                        "Content-Type": "application/json",
                        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
                    },
                },
            );

            nftInfo = (await response.json()) as z.infer<typeof getNftInfoResponseSchema>;
        } catch (error) {
            throw new Error(`Failed to get NFT listings: ${error}`);
        }

        return nftInfo[0];
    }

    @Tool({
        description: "Buy an NFT from a listing from the Magic Eden API",
    })
    async getBuyListingTransaction(walletClient: SolanaWalletClient, parameters: GetNftInfoParametersSchema) {
        const nftInfo = await this.getNftListings(parameters);

        const queryParams = new URLSearchParams({
            buyer: walletClient.getAddress(),
            seller: nftInfo.seller,
            tokenMint: parameters.mintHash,
            tokenATA: nftInfo.tokenAddress,
            price: nftInfo.price.toString(),
            ...(nftInfo.auctionHouse ? { auctionHouseAddress: nftInfo.auctionHouse } : {}),
        });

        let data: z.infer<typeof getBuyListingTransactionResponseSchema>;
        try {
            const response = await fetch(
                `https://api-mainnet.magiceden.dev/v2/instructions/buy_now?${queryParams.toString()}`,
                {
                    headers: {
                        "Content-Type": "application/json",
                        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
                    },
                },
            );

            data = (await response.json()) as z.infer<typeof getBuyListingTransactionResponseSchema>;
        } catch (error) {
            throw new Error(`Failed to get buy listing transaction: ${error}`);
        }

        const versionedTransaction = VersionedTransaction.deserialize(Buffer.from(data.v0.tx.data));
        const instructions = await walletClient.decompileVersionedTransactionToInstructions(versionedTransaction);
        const lookupTableAddresses = versionedTransaction.message.addressTableLookups.map((lookup) =>
            lookup.accountKey.toString(),
        );

        const { hash } = await walletClient.sendTransaction({
            instructions,
            addressLookupTableAddresses: lookupTableAddresses,
        });

        return hash;
    }
}
