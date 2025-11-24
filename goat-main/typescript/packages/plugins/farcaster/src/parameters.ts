import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

const paginationSchema = z.object({
    limit: z.number().min(1).max(100).optional().describe("Number of results to return"),
    cursor: z.string().optional().describe("Pagination cursor for fetching next page"),
});

export class GetCastParameters extends createToolParameters(
    z.object({
        identifier: z.string().describe("Cast URL or hash identifier"),
        type: z.enum(["url", "hash"]).default("hash").describe("Type of identifier (url or hash)"),
    }),
) {}

export class PublishCastParameters extends createToolParameters(
    z.object({
        signer_uuid: z.string().describe("UUID of the signer. Must be approved for the API key"),
        text: z.string().max(320).describe("Content of the cast (max 320 characters)"),
        parent: z.string().optional().describe("Parent URL or hash for replies"),
        channel_id: z.string().optional().describe("Channel ID to post in (e.g., 'neynar', 'farcaster')"),
        embeds: z
            .array(
                z.object({
                    url: z.string().optional(),
                    cast_id: z
                        .object({
                            hash: z.string(),
                            fid: z.number(),
                        })
                        .optional(),
                }),
            )
            .optional()
            .describe("Optional embeds for the cast (URLs or other casts)"),
    }),
) {}

export class SearchCastsParameters extends createToolParameters(
    z
        .object({
            query: z.string().describe("Search query string"),
            author_fid: z.number().optional().describe("Filter results by author FID"),
            parent_url: z.string().optional().describe("Filter by parent URL"),
            channel_id: z.string().optional().describe("Filter by channel ID"),
            priority_mode: z
                .boolean()
                .optional()
                .default(false)
                .describe("Only show results from power users and followed users"),
        })
        .merge(paginationSchema),
) {}

export class GetConversationParameters extends createToolParameters(
    z
        .object({
            identifier: z.string().describe("Cast URL or hash identifier"),
            type: z.enum(["url", "hash"]).default("hash").describe("Type of identifier (url or hash)"),
            reply_depth: z.number().min(0).max(5).optional().default(2).describe("Depth of replies to fetch (0-5)"),
            include_parent_casts: z
                .boolean()
                .optional()
                .default(false)
                .describe("Include parent casts in chronological order"),
            viewer_fid: z.number().optional().describe("Viewer's FID to include viewer-specific context"),
        })
        .merge(paginationSchema),
) {}
