import { Tool } from "@goat-sdk/core";
import { AlloraAPIClient, AlloraPricePredictionTimeframe, AlloraPricePredictionToken } from "./api";
import { GetAlloraPricePredictionParameters } from "./parameters";

export interface AlloraServiceOptions {
    apiKey?: string;
    apiRoot?: string;
}

export class AlloraService {
    private readonly client: AlloraAPIClient;

    constructor(opts: AlloraServiceOptions) {
        this.client = new AlloraAPIClient(opts);
    }

    @Tool({
        description:
            "Fetch a future price prediction for a crypto asset from Allora Network.  Specify 5 minutes from now `5m`, or 8 hours from now `8h`.",
    })
    async getPricePrediction(parameters: GetAlloraPricePredictionParameters) {
        const { ticker, timeframe } = parameters;
        return this.client.fetchAlloraPricePrediction(
            ticker as AlloraPricePredictionToken,
            timeframe as AlloraPricePredictionTimeframe,
        );
    }
}
