import { z } from "zod";

/**
 * Creates a Zod schema for Crossmint order parameters
 * @param callDataSchema - Schema for contract-specific call data validation
 * @returns Zod schema object defining the structure of order parameters
 */
export function getCreateAndPayOrderParameters(callDataSchema?: z.ZodSchema) {
    return z.object({
        recipient: z
            .object({
                email: z.string().email(),
                physicalAddress: physicalAddressSchema.optional(),
            })
            .describe(
                "Where the tokens will be sent to - either a wallet address or email, if email is provided a Crossmint wallet will be created and associated with the email",
            ),
        payment: z
            .object({
                method: z
                    .enum(["ethereum", "ethereum-sepolia", "base", "base-sepolia", "polygon", "polygon-amoy", "solana"])
                    .describe("The blockchain network to use for the transaction"), // TODO: This is not the full list of methods
                currency: z.enum(["usdc"]).describe("The currency to use for payment"), // TODO: This is not the full list of currencies
                payerAddress: z.string().describe("The address that will pay for the transaction"), // TODO: This required for now, as this will create and buy the order in 1 tool
                receiptEmail: z.string().optional().describe("Optional email to send payment receipt to"),
            })
            .describe(
                "Payment configuration - the desired blockchain, currency and address of the payer - optional receipt email, if an email recipient was not provided",
            ),
        lineItems: z
            .array(
                // TODO: Add tokenLocator support
                z.union([
                    z.object({
                        collectionLocator: z
                            .string()
                            .describe(
                                "The collection locator. Ex: 'crossmint:<crossmint_collection_id>', '<chain>:<contract_address>'",
                            ),
                        ...(callDataSchema ? { callData: callDataSchema } : {}),
                    }),
                    z.object({
                        productLocator: z
                            .string()
                            .describe("The product locator. Ex: 'amazon:<amazon_product_id>', 'amazon:<asin>'"),
                        ...(callDataSchema ? { callData: callDataSchema } : {}),
                    }),
                ]),
            )
            .describe("Array of items to purchase"),
    });
}

export const physicalAddressSchema = z
    .object({
        name: z.string().min(1, "Name is required for physical address"),
        line1: z.string().min(1, "Line 1 is required for physical address"),
        line2: z.string().optional(),
        city: z.string().min(1, "City is required for physical address"),

        state: z.string().optional().describe("State/Province/Region - optional"),
        postalCode: z.string().min(1, "Postal/ZIP code is required for physical address"),
        country: z
            .string()
            .min(2, "Country is required for physical address")
            .max(2, "Country must be a 2-letter ISO code for physical address")
            .toUpperCase(),
    })
    .superRefine((data, ctx) => {
        // TODO: allow more countries
        if (data.country !== "US") {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Only 'US' country code is supported at this time",
            });
        }

        if (data.country === "US" && !data.state) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "State is required for US physical address",
            });
        }
    })
    .describe("International mailing address using ISO 3166-1 alpha-2 country codes");
