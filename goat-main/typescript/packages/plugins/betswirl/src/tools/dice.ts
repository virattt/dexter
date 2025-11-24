import { createTool } from "@goat-sdk/core";
import { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { type Hex } from "viem";
import { z } from "zod";

import {
    CASINO_GAME_TYPE,
    Dice,
    DiceNumber,
    MAX_SELECTABLE_DICE_NUMBER,
    MIN_SELECTABLE_DICE_NUMBER,
} from "@betswirl/sdk-core";

import { casinoBetParams, getMaxBetCountParam } from "../parameters";
import { getBet, getBetAmountInWei, getBetToken, placeBet } from "../utils/betswirl";

export function createDiceTool(walletClient: EVMWalletClient, theGraphKey?: string) {
    return createTool(
        {
            name: "betswirl_dice",
            description:
                "Play the BetSwirl Dice. The player is betting that the rolled number will be above this chosen number. The user input also contains the bet amount (in ether unit), and the token symbol.",
            parameters: z.object({
                number: z
                    .number()
                    .gte(MIN_SELECTABLE_DICE_NUMBER)
                    .lte(MAX_SELECTABLE_DICE_NUMBER)
                    .describe("The number to bet on"),
                ...casinoBetParams,
                ...getMaxBetCountParam(CASINO_GAME_TYPE.DICE),
            }),
        },
        async (parameters) => {
            const number = parameters.number as DiceNumber;

            // Get the bet token from the user input
            const selectedToken = await getBetToken(walletClient, parameters.token);

            // Validate the bet amount
            const betAmountInWei = getBetAmountInWei(parameters.betAmount, selectedToken);

            const hash = await placeBet(
                walletClient,
                CASINO_GAME_TYPE.DICE,
                Dice.encodeInput(number),
                Dice.getMultiplier(number),
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
