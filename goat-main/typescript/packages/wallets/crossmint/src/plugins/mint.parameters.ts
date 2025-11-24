import { z } from "zod";

import { createToolParameters } from "@goat-sdk/core";

export class CollectionParameters extends createToolParameters(
    z.object({
        metadata: z
            .object({
                name: z.string().describe("The name of the collection"),
                description: z.string().describe("A description of the NFT collection"),
                image: z.string().optional().describe("URL pointing to an image that represents the collection"),
                symbol: z
                    .string()
                    .optional()
                    .describe("Shorthand identifier for the NFT collection (Max length: 10). Defaults to 'TOKEN'"),
            })
            .default({
                name: "My first Minting API Collection",
                description:
                    "An NFT Collection created with the Crossmint Minting API - learn more at https://www.crossmint.com/products/nft-minting-api",
                image: "https://www.crossmint.com/assets/crossmint/logo.png",
            })
            .describe("The metadata of the collection"),
        fungibility: z
            .enum(["semi-fungible", "non-fungible"])
            .optional()
            .default("non-fungible")
            .describe("Whether or not this collection is fungible (e.g ERC-1155 vs ERC-721)"),
        transferable: z
            .boolean()
            .optional()
            .default(true)
            .describe("Whether or not the NFTs in this collection are transferable"),
    }),
) {}

export class GetAllCollectionsParameters extends createToolParameters(z.object({})) {}

export class MintNFTParameters extends createToolParameters(
    z.object({
        collectionId: z.string().describe("The ID of the collection to mint the NFT in"),
        recipient: z.string().describe("The recipient of the NFT, this can be a wallet address or an email address"),
        recipientType: z
            .enum(["wallet", "email"])
            .optional()
            .default("email")
            .describe("The type of the recipient, either 'wallet' or 'email'"),
        metadata: z
            .object({
                name: z.string().describe("The name of the NFT"),
                description: z.string().max(64).describe("The description of the NFT"),
                image: z.string().describe("URL pointing to the NFT image"),
                animation_url: z.string().optional().describe("URL pointing to the NFT animation"),
                attributes: z
                    .array(
                        z.object({
                            display_type: z
                                .enum(["number", "boost_number", "boost_percentage"])
                                .describe("The type of the attribute, if it's a number or a percentage"),
                            value: z.string().describe("The trait value"),
                        }),
                    )
                    .optional()
                    .describe("The attributes of the NFT"),
            })
            .describe("The metadata of the NFT"),
    }),
) {}
