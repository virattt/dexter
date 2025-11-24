import { createTool } from "@goat-sdk/core";
import { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { type Hex } from "viem";
import { z } from "zod";

import { CASINO_GAME_TYPE, COINTOSS_FACE, CoinToss } from "@betswirl/sdk-core";

import { casinoBetParams, getMaxBetCountParam } from "../parameters";
import { getBet, getBetAmountInWei, getBetToken, placeBet } from "../utils/betswirl";

export function createCoinTossTool(walletClient: EVMWalletClient, theGraphKey?: string) {
    return createTool(
        {
            name: "betswirl_coinToss",
            description:
                "Flip a coin on BetSwirl. The player is betting that the rolled face will be the one chosen. The user input also contains the bet amount (in ether unit), and the token symbol.",
            parameters: z.object({
                face: z.nativeEnum(COINTOSS_FACE).describe("The face of the coin"),
                ...casinoBetParams,
                ...getMaxBetCountParam(CASINO_GAME_TYPE.COINTOSS),
            }),
        },
        async (parameters) => {
            const face = parameters.face as COINTOSS_FACE;

            // Get the bet token from the user input
            const selectedToken = await getBetToken(walletClient, parameters.token);

            // Validate the bet amount
            const betAmountInWei = getBetAmountInWei(parameters.betAmount, selectedToken);

            const hash = await placeBet(
                walletClient,
                CASINO_GAME_TYPE.COINTOSS,
                CoinToss.encodeInput(face),
                CoinToss.getMultiplier(face),
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
