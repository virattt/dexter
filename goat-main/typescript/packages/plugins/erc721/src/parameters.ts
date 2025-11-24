import { z } from "zod";

export const getBalanceParametersSchema = z.object({
    wallet: z.string().describe("The address to get the NFT balance of"),
});

export const transferParametersSchema = z.object({
    to: z.string().describe("The address to transfer the NFT to"),
    tokenId: z.string().describe("The ID of the NFT to transfer"),
});

export const totalSupplyParametersSchema = z.object({});

export const approveParametersSchema = z.object({
    spender: z.string().describe("The address to approve for the NFT"),
    tokenId: z.string().describe("The ID of the NFT to approve"),
});

export const transferFromParametersSchema = z.object({
    from: z.string().describe("The address to transfer the NFT from"),
    to: z.string().describe("The address to transfer the NFT to"),
    tokenId: z.string().describe("The ID of the NFT to transfer"),
});

export const ownerOfParametersSchema = z.object({
    tokenId: z.string().describe("The ID of the NFT to check ownership of"),
});
