import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

export class GetNftCollectionStatisticsParametersSchema extends createToolParameters(
    z.object({
        collectionSlug: z.string(),
    }),
) {}

export class GetNftSalesParametersSchema extends createToolParameters(
    z.object({
        collectionSlug: z.string(),
    }),
) {}

export const GetNftCollectionStatisticsResponseSchema = z.object({
    total: z.object({
        volume: z.number(),
        sales: z.number(),
        average_price: z.number(),
        num_owners: z.number(),
        market_cap: z.number(),
        floor_price: z.number(),
        floor_price_symbol: z.string(),
    }),
    intervals: z.array(
        z.object({
            interval: z.string(),
            volume: z.number(),
            volume_diff: z.number(),
            volume_change: z.number(),
            sales: z.number(),
            sales_diff: z.number(),
            average_price: z.number(),
        }),
    ),
});

export const GetNftSalesResponseSchema = z.object({
    asset_events: z.array(
        z.object({
            event_type: z.string(),
            order_hash: z.string(),
            chain: z.string(),
            protocol_address: z.string(),
            closing_date: z.number(),
            nft: z.object({
                identifier: z.string(),
                collection: z.string(),
                contract: z.string(),
                token_standard: z.string(),
                name: z.string(),
                description: z.string(),
                image_url: z.string(),
                display_image_url: z.string(),
                display_animation_url: z.string().nullable(),
                metadata_url: z.string(),
                opensea_url: z.string(),
                updated_at: z.string(),
                is_disabled: z.boolean(),
                is_nsfw: z.boolean(),
            }),
            quantity: z.number(),
            seller: z.string(),
            buyer: z.string(),
            payment: z.object({
                quantity: z.string(),
                token_address: z.string(),
                decimals: z.number(),
                symbol: z.string(),
            }),
            transaction: z.string(),
            event_timestamp: z.number(),
        }),
    ),
    next: z.string(),
});
