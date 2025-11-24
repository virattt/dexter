import { Tool } from "@goat-sdk/core";
import { SearchParameters, StartRedemptionParameters, VerifyRedemptionParameters } from "./parameters";

export class WorldstoreService {
    constructor(public baseUrl: string) {}

    @Tool({
        description: "Searches for products on all stores within the WorldStore",
    })
    async searchForProduct(parameters: SearchParameters) {
        const queryParams = new URLSearchParams({
            query: parameters.query,
        });
        if (parameters.limit) {
            queryParams.set("limit", parameters.limit);
        }
        const res = await fetch(`${this.baseUrl}/api/worldstore/products/search?${queryParams.toString()}`);
        const json = await res.json();
        return json;
    }

    @Tool({
        description: "Starts the redemption process for products purchased from a WorldStore",
    })
    async startRedemption(parameters: StartRedemptionParameters) {
        console.log("Starting redemption for shop:", parameters.shopId);
        const res = await fetch(`${this.baseUrl}/api/worldstore/shops/${parameters.shopId}/redemption/start`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                walletAddress: parameters.walletAddress,
                items: parameters.items,
                userInformation: parameters.userInformation,
            }),
        });
        const json = await res.json();
        console.log("Redemption started:", json);
        return json;
    }

    @Tool({
        description: "Verifies a redemption with a signed message",
    })
    async verifyRedemption(parameters: VerifyRedemptionParameters) {
        console.log("Verifying redemption:", parameters.redemptionId);
        const res = await fetch(
            `${this.baseUrl}/api/worldstore/shops/${parameters.shopId}/redemption/${parameters.redemptionId}/verify`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    signedMessage: parameters.signedMessage,
                }),
            },
        );
        const json = await res.json();
        console.log("Redemption verified:", json);
        return json;
    }
}
