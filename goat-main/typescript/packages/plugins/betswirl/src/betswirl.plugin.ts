import { Chain, PluginBase } from "@goat-sdk/core";
import { EVMWalletClient } from "@goat-sdk/wallet-evm";

import {
    CASINO_GAME_TYPE,
    type CasinoChainId,
    casinoChainById,
    casinoChains,
    getGamePausedFunctionData,
} from "@betswirl/sdk-core";
import { createCoinTossTool } from "./tools/coinToss";
import { createDiceTool } from "./tools/dice";
import { createGetBetTool } from "./tools/getBet";
import { createGetBetsTool } from "./tools/getBets";
import { createRouletteTool } from "./tools/roulette";

export class BetSwirlPlugin extends PluginBase<EVMWalletClient> {
    private theGraphKey?: string;

    constructor(theGraphKey?: string) {
        super("betswirl", []);
        this.theGraphKey = theGraphKey;
    }

    supportsChain = (chain: Chain) =>
        chain.type === "evm" && casinoChains.some((casinoChain) => casinoChain.id === chain.id);

    async getTools(walletClient: EVMWalletClient) {
        const chainGames = await getCasinoGames(walletClient);
        const gamesTools = [];
        gamesTools.push(createGetBetsTool(walletClient, this.theGraphKey));
        gamesTools.push(createGetBetTool(walletClient, this.theGraphKey));
        if (chainGames.includes(CASINO_GAME_TYPE.DICE)) {
            gamesTools.push(createDiceTool(walletClient));
        }
        if (chainGames.includes(CASINO_GAME_TYPE.COINTOSS)) {
            gamesTools.push(createCoinTossTool(walletClient));
        }
        if (chainGames.includes(CASINO_GAME_TYPE.ROULETTE)) {
            gamesTools.push(createRouletteTool(walletClient));
        }
        return gamesTools;
    }
}

export function betswirl(theGraphKey?: string) {
    return new BetSwirlPlugin(theGraphKey);
}

async function getCasinoGames(wallet: EVMWalletClient) {
    const chainId = wallet.getChain().id as CasinoChainId;
    const casinoChain = casinoChainById[chainId];
    const games = Object.keys(casinoChain.contracts.games) as CASINO_GAME_TYPE[];
    const gamesPausedStatus = await Promise.all(
        games.map(async (game) => {
            const gamePausedFunctionData = getGamePausedFunctionData(game, chainId);
            const { value: paused } = (await wallet.read({
                address: gamePausedFunctionData.data.to,
                functionName: gamePausedFunctionData.data.functionName,
                abi: gamePausedFunctionData.data.abi,
            })) as { value: boolean };

            return {
                name: game,
                paused,
            };
        }),
    );
    return gamesPausedStatus.filter((game) => !game.paused).map((game) => game.name);
}
