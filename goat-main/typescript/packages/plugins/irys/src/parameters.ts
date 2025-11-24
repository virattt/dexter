import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

export const IrysPaymentToken = z
    .enum([
        "ethereum",
        "matic",
        "bnb",
        "avalanche",
        "baseeth",
        "usdceth",
        "arbitrum",
        "chainlink",
        "usdcpolygon",
        "bera",
        "scrolleth",
        "lineaeth",
        "iotex",
    ])
    .describe("Payment token for Irys network");

export type IrysPaymentToken = z.infer<typeof IrysPaymentToken>;

export class FundAccountParameters extends createToolParameters(
    z.object({
        amount: z.number().describe("The amount of tokens to fund the account with"),
    }),
) {}

export class UploadDataParameters extends createToolParameters(
    z.object({
        data: z.string().describe("The data to upload"),
    }),
) {}

export class UploadFileParameters extends createToolParameters(
    z.object({
        filePath: z.string().describe("The file path of the file to upload"),
        name: z.string().optional().default("").describe("The name of the file"),
        value: z.string().optional().default("").describe("The value of the file"),
    }),
) {}

export class UploadFolderParameters extends createToolParameters(
    z.object({
        folderPath: z.string().describe("The folder path of the folder to upload"),
        indexFile: z
            .string()
            .optional()
            .default("")
            .describe("Optional index file (file the user will load when accessing the manifest)"),
        batchSize: z.number().optional().default(50).describe("Number of items to upload at once"),
        keepDeleted: z
            .boolean()
            .optional()
            .default(false)
            .describe("Boolean determining whether to keep now deleted items from previous uploads"),
    }),
) {}

export class DownloadDataParameters extends createToolParameters(
    z.object({
        transactionId: z.string().describe("The transaction ID of the data to download"),
    }),
) {}

export class FundResponse extends createToolParameters(
    z.object({
        id: z.string().describe("The transaction ID of the fund transfer"),
        quantity: z.number().describe("How much is being transferred"),
        reward: z.number().describe("The amount taken by the network as a fee"),
        target: z.string().describe("The address the funds were sent to"),
        token: z.string().describe("The token of the transaction"),
    }),
) {}

export class UploadResponse extends createToolParameters(
    z.object({
        id: z.string().describe("Transaction ID (used to download the data)"),
    }),
) {}
