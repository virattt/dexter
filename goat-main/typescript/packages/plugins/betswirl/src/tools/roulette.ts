import { createTool } from "@goat-sdk/core";
import { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { type Hex } from "viem";
import { z } from "zod";

import {
    CASINO_GAME_TYPE,
    MAX_SELECTABLE_ROULETTE_NUMBER,
    MIN_SELECTABLE_ROULETTE_NUMBER,
    Roulette,
    RouletteNumber,
} from "@betswirl/sdk-core";

import { casinoBetParams, getMaxBetCountParam } from "../parameters";
import { getBet, getBetAmountInWei, getBetToken, placeBet } from "../utils/betswirl";

export function createRouletteTool(walletClient: EVMWalletClient, theGraphKey?: string) {
    return createTool(
        {
            name: "betswirl_roulette",
            description:
                "Play the BetSwirl Roulette. The player is betting that the rolled number will be one of the chosen numbers. The user input also contains the bet amount (in ether unit), and the token symbol.",
            parameters: z.object({
                numbers: z
                    .number()
                    .gte(MIN_SELECTABLE_ROULETTE_NUMBER)
                    .lte(MAX_SELECTABLE_ROULETTE_NUMBER)
                    .array()
                    .min(1)
                    .max(MAX_SELECTABLE_ROULETTE_NUMBER)
                    .describe("The numbers to bet on"),
                ...casinoBetParams,
                ...getMaxBetCountParam(CASINO_GAME_TYPE.ROULETTE),
            }),
        },
        async (parameters) => {
            const numbers = parameters.numbers as RouletteNumber[];

            // Get the bet token from the user input
            const selectedToken = await getBetToken(walletClient, parameters.token);

            // Validate the bet amount
            const betAmountInWei = getBetAmountInWei(parameters.betAmount, selectedToken);

            const hash = await placeBet(
                walletClient,
                CASINO_GAME_TYPE.ROULETTE,
                Roulette.encodeInput(numbers),
                Roulette.getMultiplier(numbers),
                {
                    betAmount: betAmountInWei,
                    betToken: selectedToken,
                    betCount: 1,
                    receiver: walletClient.getAddress() as Hex,
                    stopGain: 0n,
                    stopLoss: 0n,
                },
            );

            return await getBet(walletClient, hash, theGraphKey);
        },
    );
}
