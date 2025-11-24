import { z } from "zod";

export const getEventsParametersSchema = z.object({
    id: z.optional(z.string()).describe("The id of the event to get"),
    slug: z.optional(z.string()).describe("The slug of the event to get"),
    archived: z.optional(z.boolean()).describe("Whether to get archived events or not"),
    active: z.optional(z.boolean()).default(true).describe("Whether to filter by only active events or not"),
    closed: z.optional(z.boolean()).default(false).describe("Whether to get closed events or not"),
    startDateMin: z.optional(z.string()).describe("The minimum start date of the events to get"),
    startDateMax: z.optional(z.string()).describe("The maximum start date of the events to get"),
    endDateMin: z.optional(z.string()).describe("The minimum end date of the events to get"),
    endDateMax: z.optional(z.string()).describe("The maximum end date of the events to get"),
    ascending: z.optional(z.boolean()).describe("Whether to get the events in ascending order or not"),
    order: z
        .optional(z.enum(["startDate", "endDate", "slug", "liquidity", "volume"]))
        .describe("The field to order the events by"),
    limit: z.optional(z.number()).describe("The maximum number of events to get"),
    offset: z.optional(z.number()).describe("The number of events to skip"),
    liquidityMin: z.optional(z.number()).describe("The minimum liquidity of the events to get"),
    tagSlug: z.optional(z.string()).describe("Keyword to search events by"),
    showOnlyMarketsAcceptingOrders: z
        .optional(z.boolean())
        .default(true)
        .describe("Whether to show only markets accepting orders"),
});

export const getMarketInfoParametersSchema = z.object({
    id: z.string().describe("The id of the market to get"),
});

export const createOrderParametersSchema = z.object({
    type: z
        .enum(["FOK", "GTC", "GTD"])
        .describe(
            "The type of the order:\n" +
                "- `FOK`: A 'Fill-Or-Kill' order is a market order to buy shares that must be executed immediately in its entirety; otherwise, the entire order will be cancelled.\n" +
                "- `GTC`: A 'Good-Til-Cancelled' order is a limit order that is active until it is fulfilled or cancelled.\n" +
                "- `GTD`: A 'Good-Til-Day' order is active until its specified expiration date (provided as a UTC seconds timestamp).",
        ),
    tokenId: z.string().describe("ERC1155 token ID of the conditional token being traded"),
    price: z.string().describe("Price of the conditional token being traded"),
    size: z.number().describe("How many shares to buy or sell"),
    expiration: z.number().describe("Time in seconds until the order expires"),
    side: z.enum(["BUY", "SELL"]).describe("Buy or sell"),
});

export const getOpenOrdersParametersSchema = z.object({
    id: z.optional(z.string()).describe("The id of the order to get"),
    market: z.optional(z.string()).describe("The market of the order to get"),
    asset_id: z.optional(z.string()).describe("The id of the asset or token to get"),
});

export const cancelOrderParametersSchema = z.object({
    id: z.string().describe("The id of the order to cancel"),
});

export const cancelAllOrdersParametersSchema = z.object({});
