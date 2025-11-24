import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

export class GetNftInfoParameters extends createToolParameters(
    z.object({
        mintHash: z.string().describe("The mint hash of the NFT"),
    }),
) {}

export const getNftInfoResponseSchema = z.array(
    z.object({
        onchainId: z.string(),
        attributes: z.array(z.any()),
        imageUri: z.string().optional(),
        lastSale: z
            .object({
                price: z.string(),
                priceUnit: z.string(),
            })
            .optional(),
        metadataUri: z.string().optional(),
        name: z.string().optional(),
        rarityRankTT: z.number().optional(),
        rarityRankTTStat: z.number().optional(),
        rarityRankHrtt: z.number().optional(),
        rarityRankStat: z.number().optional(),
        sellRoyaltyFeeBPS: z.number().optional(),
        tokenEdition: z.string().optional(),
        tokenStandard: z.string().optional(),
        hidden: z.boolean().optional(),
        compressed: z.boolean().optional(),
        verifiedCollection: z.string().optional(),
        owner: z.string().optional(),
        inscription: z.string().optional(),
        tokenProgram: z.string().optional(),
        metadataProgram: z.string().optional(),
        transferHookProgram: z.string().optional(),
        listingNormalizedPrice: z.string().optional(),
        hybridAmount: z.string().optional(),
        listing: z
            .object({
                price: z.string(),
                txId: z.string(),
                seller: z.string(),
                source: z.string(),
            })
            .optional(),
        slugDisplay: z.string().optional(),
        collId: z.string().optional(),
        collName: z.string().optional(),
        numMints: z.number().optional(),
    }),
);

export const getBuyListingTransactionResponseSchema = z.object({
    txs: z.array(
        z.object({
            tx: z.object({
                type: z.string(),
                data: z.array(z.number()),
            }),
            txV0: z.object({
                type: z.string(),
                data: z.array(z.number()),
            }),
        }),
    ),
});
