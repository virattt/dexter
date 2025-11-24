import { Tool } from "@goat-sdk/core";
import { z } from "zod";
import {
    GetNftCollectionStatisticsParametersSchema,
    GetNftCollectionStatisticsResponseSchema,
    GetNftSalesParametersSchema,
    GetNftSalesResponseSchema,
} from "./parameters";

export class OpenseaService {
    constructor(private readonly apiKey: string) {}

    @Tool({
        description: "Get NFT collection statistics",
    })
    async getNftCollectionStatistics(parameters: GetNftCollectionStatisticsParametersSchema) {
        let nftCollectionStatistics: z.infer<typeof GetNftCollectionStatisticsResponseSchema>;
        try {
            const response = await fetch(
                `https://api.opensea.io/api/v2/collections/${parameters.collectionSlug}/stats`,
                {
                    headers: {
                        accept: "application/json",
                        "x-api-key": this.apiKey,
                    },
                },
            );

            nftCollectionStatistics = (await response.json()) as z.infer<
                typeof GetNftCollectionStatisticsResponseSchema
            >;
        } catch (error) {
            throw new Error(`Failed to get NFT collection statistics: ${error}`);
        }

        return nftCollectionStatistics;
    }

    @Tool({
        description: "Get recent NFT Sales",
    })
    async getNftSales(parameters: GetNftSalesParametersSchema) {
        let nftSales: z.infer<typeof GetNftSalesResponseSchema>;
        try {
            const response = await fetch(
                `https://api.opensea.io/api/v2/events/collection/${parameters.collectionSlug}?event_type=sale&limit=5`,
                {
                    headers: {
                        accept: "application/json",
                        "x-api-key": this.apiKey,
                    },
                },
            );

            nftSales = (await response.json()) as z.infer<typeof GetNftSalesResponseSchema>;
        } catch (error) {
            throw new Error(`Failed to get NFT sales: ${error}`);
        }

        return nftSales.asset_events.map((event) => {
            return {
                name: event.nft.name,
                seller: event.seller,
                buyer: event.buyer,
                price: Number(event.payment.quantity) / 10 ** 18,
            };
        });
    }
}
