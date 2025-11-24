import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

export class GetAlloraPricePredictionParameters extends createToolParameters(
    z.object({
        ticker: z.enum(["BTC", "ETH"]).describe("The ticker of the currency for which to fetch a price prediction."),
        timeframe: z.enum(["5m", "8h"]).describe('The timeframe for the prediction (currently, either "5m" or "8h").'),
    }),
) {}
