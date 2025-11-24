import { createTool } from "@goat-sdk/core";
import { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { type Hex } from "viem";
import { z } from "zod";

import { CASINO_GAME_TYPE, CasinoChainId, FORMAT_TYPE, fetchBets, formatTxnUrl, slugById } from "@betswirl/sdk-core";

import { hexAddress } from "../parameters";

export function createGetBetsTool(walletClient: EVMWalletClient, theGraphKey?: string) {
    return createTool(
        {
            name: "betswirl_getBets",
            description:
                "Get bets from BetSwirl. If no player is specified its listing the current connected player bets. If no game is specified its listing all games bets.",
            parameters: z.object({
                bettor: hexAddress.optional().describe("The bettor address"),
                game: z.nativeEnum(CASINO_GAME_TYPE).optional().describe("The game to get the bets for"),
            }),
        },
        async (parameters) => {
            const bettor = parameters.bettor as Hex;
            const game = parameters.game as CASINO_GAME_TYPE;
            const chainId = walletClient.getChain().id as CasinoChainId;

            const bets = await getSubgraphBets(chainId, bettor, game, theGraphKey);

            return bets;
        },
    );
}
async function getSubgraphBets(chainId: CasinoChainId, bettor: Hex, game: CASINO_GAME_TYPE, theGraphKey?: string) {
    try {
        const bets = await fetchBets(
            { chainId, theGraphKey, formatType: FORMAT_TYPE.PRECISE },
            {
                bettor,
                game,
            },
            undefined,
            5,
        );
        if (bets.error) {
            throw new Error(`[${bets.error.code}] Error fetching bets: ${bets.error.message}`);
        }
        return bets.bets.map((bet) => ({
            id: String(bet.id),
            input: bet.decodedInput,
            betTxnHash: bet.betTxnHash,
            betTxnLink: formatTxnUrl(bet.betTxnHash, chainId),
            betAmount: bet.formattedBetAmount,
            token: bet.token.symbol,
            isWin: bet.isWin,
            payoutMultiplier: bet.payoutMultiplier,
            rolled: bet.decodedRolled,
            payout: bet.formattedPayout,
            rollTxnHash: bet.rollTxnHash,
            rollTxnLink: bet.rollTxnHash ? formatTxnUrl(bet.rollTxnHash, chainId) : null,
            linkOnBetSwirl: `https://www.betswirl.com/${slugById[chainId]}/casino/${bet.game}/${bet.id}`,
        }));
    } catch (error) {
        throw new Error(`An error occured while getting the bet: ${error}`);
    }
}
