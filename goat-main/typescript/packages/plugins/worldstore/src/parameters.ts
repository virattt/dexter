import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

export class SearchParameters extends createToolParameters(
    z.object({
        query: z.string(),
        limit: z.string().optional(),
    }),
) {}

export class BuyProductParameters extends createToolParameters(
    z.object({
        contractAddress: z.string(),
        productId: z.string(),
        to: z.string(),
        quantity: z.number(),
    }),
) {}

const ShippingAddressSchema = z.object({
    address1: z.string(),
    address2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    postalCode: z.string(),
    country: z.enum(["US"]),
});

export class StartRedemptionParameters extends createToolParameters(
    z.object({
        shopId: z.string(),
        walletAddress: z.string(),
        items: z.array(
            z.object({
                productId: z.string(),
                quantity: z.number().int().positive(),
            }),
        ),
        userInformation: z.object({
            firstName: z.string().optional(),
            lastName: z.string().optional(),
            email: z.string().email().optional(),
            phone: z.string().optional(),
            shippingAddress: ShippingAddressSchema.optional(),
        }),
    }),
) {}

export class VerifyRedemptionParameters extends createToolParameters(
    z.object({
        shopId: z.string(),
        redemptionId: z.string(),
        signedMessage: z.string(),
    }),
) {}
