import { Tool } from "@goat-sdk/core";
import { SynthAPI } from "./api";
import { SynthApiPredictionBestParameters } from "./parameters";

interface Prediction {
    time: string;
    price: number;
}

interface PredictionBest {
    miner_uid: number;
    prediction: Prediction[][];
}

type PredictionBestResponse = PredictionBest[];

export class SynthApiService {
    constructor(protected api: SynthAPI) {}

    @Tool({
        name: "synth_api_prediction_best_in_one_day_first_path",
        description: `
            Get the prediction of future possible bitcoin price according to the best miner in synth subnet on bittensor,
            by step of 5 minutes over the next 24 hours, times are in UTC ISO format.
            It returns the first path of the prediction, so 288 points. So it's good for question about future price."
        `.trim(),
    })
    async synthAPIPredictionBestFirstPath(_: SynthApiPredictionBestParameters) {
        const responses = (await this.api.request("prediction/best", {
            // we hardcode the parameter for now because the API only supports BTC, 300 and 86400
            asset: "BTC",
            time_increment: 300,
            time_length: 86400,
        })) as PredictionBestResponse;

        if (responses) {
            if (responses.length === 0) {
                throw new Error("No prediction found");
            }

            const response = responses[0];
            const prediction = response.prediction;
            return prediction[0];
        }
        throw new Error("No prediction found");
    }

    @Tool({
        name: "synth_api_prediction_best_in_one_day",
        description: `
            Get the prediction of future possible bitcoin price according to the best miner in synth subnet,
            by step of 5 minutes over the next 24 hours, times are in UTC ISO format.
            It returns the all the paths of the prediction, so 100 times 288 points, so it's good for question about future possible price paths."
        `.trim(),
    })
    async synthAPIPredictionBest(_: SynthApiPredictionBestParameters) {
        const responses = (await this.api.request("prediction/best", {
            // we hardcode the parameter for now because the API only supports BTC, 300 and 86400
            asset: "BTC",
            time_increment: 300,
            time_length: 86400,
        })) as PredictionBestResponse;

        if (responses) {
            if (responses.length === 0) {
                throw new Error("No prediction found");
            }

            const response = responses[0];
            const prediction = response.prediction;
            return prediction;
        }
        throw new Error("No prediction found");
    }
}
