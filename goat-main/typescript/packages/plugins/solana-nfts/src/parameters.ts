import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

export class TransferNftParameters extends createToolParameters(
    z.object({
        recipientAddress: z.string().describe("The address to send the NFT to"),
        assetId: z.string().describe("The asset ID of the NFT to send"),
    }),
) {}
