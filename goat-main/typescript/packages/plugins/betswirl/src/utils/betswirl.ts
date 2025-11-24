import {
    type CASINO_GAME_TYPE,
    type CasinoChainId,
    FORMAT_TYPE,
    type GameEncodedInput,
    type RawBetRequirements,
    type RawCasinoToken,
    type Token,
    casinoChainById,
    chainNativeCurrencyToToken,
    fetchBetByHash,
    formatTxnUrl,
    getBetRequirementsFunctionData,
    getCasinoTokensFunctionData,
    getPlaceBetFunctionData,
    parseRawBetRequirements,
    rawTokenToToken,
    slugById,
} from "@betswirl/sdk-core";
import { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { type Hex, parseUnits } from "viem";

export async function getBetToken(wallet: EVMWalletClient, tokenSymbolInput?: string) {
    const chainId = wallet.getChain().id as CasinoChainId;
    const casinoChain = casinoChainById[chainId];
    let selectedToken: Token | undefined;
    if (tokenSymbolInput && tokenSymbolInput !== casinoChain.viemChain.nativeCurrency.symbol) {
        const casinoTokens = await getCasinoTokens(wallet);
        // Validate the token
        selectedToken = casinoTokens.find((casinoToken) => casinoToken.symbol === tokenSymbolInput);
        if (!selectedToken) {
            throw new Error(
                `The token must be one of ${casinoTokens.map((casinoToken) => casinoToken.symbol).join(", ")}`,
            );
        }
    } else {
        selectedToken = chainNativeCurrencyToToken(casinoChain.viemChain.nativeCurrency);
    }
    return selectedToken;
}

export function getBetAmountInWei(betAmount: string, token: Token) {
    const betAmountInWei = parseUnits(betAmount, token.decimals);
    if (betAmountInWei <= 0n) {
        throw new Error("The bet amount must be greater than 0");
    }
    return betAmountInWei;
}

async function getBetRequirements(
    walletClient: EVMWalletClient,
    game: CASINO_GAME_TYPE,
    betToken: Token,
    multiplier: number,
) {
    const chainId = walletClient.getChain().id as CasinoChainId;
    try {
        const betRequirementsFunctionData = getBetRequirementsFunctionData(betToken.address, multiplier, chainId);
        const { value: rawBetRequirements } = (await walletClient.read({
            address: betRequirementsFunctionData.data.to,
            functionName: betRequirementsFunctionData.data.functionName,
            abi: betRequirementsFunctionData.data.abi,
            args: betRequirementsFunctionData.data.args as unknown as unknown[],
        })) as { value: RawBetRequirements };

        return parseRawBetRequirements(rawBetRequirements, betToken, multiplier, game, chainId);
    } catch (error) {
        throw new Error(`An error occured while getting the bet requirements: ${error}`);
    }
}

async function getChainlinkVrfCost(
    walletClient: EVMWalletClient,
    game: CASINO_GAME_TYPE,
    betToken: Hex,
    betCount: number,
    gasPrice: bigint,
) {
    const chainId = walletClient.getChain().id as CasinoChainId;
    try {
        /* WORKAROUND: We don't have a way to read the chainlink vrf cost because we cannot pass gasPrice in walletClient.read, so we fetch it from the api.
            The issue is the gasPrice used to estimate the VRF fees on API side can be different from the one used while calling walletClient.sendTransaction. It means the placeBet call function may fail...
            To avoid that, we ideally need gasPrice both in the read and in the sendTransaction call, but at least gasPrice in the sendTransaction call.
        */
        // const chainlinkVRFCostFunctionData = getChainlinkVrfCostFunctionData(
        //     game,
        //     betToken,
        //     betCount,
        //     chainId
        // );
        // const { value: chainlinkVRFCost } = (await walletClient.read({
        //     address: chainlinkVRFCostFunctionData.data.to,
        //     functionName: chainlinkVRFCostFunctionData.data.functionName,
        //     abi: chainlinkVRFCostFunctionData.data.abi,
        //     args: chainlinkVRFCostFunctionData.data
        //         .args as unknown as unknown[],
        // })) as { value: bigint };
        // return chainlinkVRFCost;

        const params = new URLSearchParams({
            game: game.toString(),
            tokenAddress: betToken,
            betCount: betCount.toString(),
            chainId: chainId.toString(),
        });
        const response = await fetch(`https://api.betswirl.com/api/vrfFees?${params}`, {});

        if (!response.ok) {
            throw new Error(`An error occured while fetching the chainlink vrf cost from API: ${response.statusText}`);
        }
        return BigInt(await response.json());
    } catch (error) {
        throw new Error(`An error occured while getting the chainlink vrf cost: ${error}`);
    }
}

export async function placeBet(
    walletClient: EVMWalletClient,
    game: CASINO_GAME_TYPE,
    gameEncodedInput: GameEncodedInput,
    gameMultiplier: number,
    casinoGameParams: {
        betAmount: bigint;
        betToken: Token;
        betCount: number;
        receiver: Hex;
        stopGain: bigint;
        stopLoss: bigint;
    },
) {
    const chainId = walletClient.getChain().id as CasinoChainId;
    const betRequirements = await getBetRequirements(walletClient, game, casinoGameParams.betToken, gameMultiplier);

    if (!betRequirements.isAllowed) {
        throw new Error(`The token isn't allowed for betting`);
    }
    if (casinoGameParams.betAmount > betRequirements.maxBetAmount) {
        throw new Error(`Bet amount should be less than ${betRequirements.maxBetAmount}`);
    }
    if (casinoGameParams.betCount > betRequirements.maxBetCount) {
        throw new Error(`Bet count should be less than ${betRequirements.maxBetCount}`);
    }

    const functionData = getPlaceBetFunctionData(
        {
            betAmount: casinoGameParams.betAmount,

            game,
            gameEncodedInput: gameEncodedInput,
            receiver: casinoGameParams.receiver,
            betCount: casinoGameParams.betCount,
            tokenAddress: casinoGameParams.betToken.address,
            stopGain: casinoGameParams.stopGain,
            stopLoss: casinoGameParams.stopLoss,
        },
        chainId,
    );

    try {
        // Get can't get gas price from the provider. c.f. `getChainlinkVrfCost` comments.
        // const gasPrice =
        //     ((await walletClient.getGasPrice()) *
        //         120n) /
        //     100n;

        const vrfCost =
            ((await getChainlinkVrfCost(
                walletClient,
                game,
                casinoGameParams.betToken.address,
                casinoGameParams.betCount,
                0n, //gasPrice that we couldn't get from provider
            )) *
                120n) /
            100n;
        const { hash: betHash } = await walletClient.sendTransaction({
            to: functionData.data.to,
            functionName: functionData.data.functionName,
            args: functionData.data.args as unknown as unknown[],
            value: functionData.extraData.getValue(vrfCost),
            abi: functionData.data.abi,
        });

        return betHash as Hex;
    } catch (error) {
        throw new Error(`An error occured while placing the bet: ${error}`);
    }
}

export async function getBet(walletClient: EVMWalletClient, txHash: Hex, theGraphKey?: string) {
    const chainId = walletClient.getChain().id as CasinoChainId;
    try {
        let betData = await fetchBetByHash(txHash, {
            chainId,
            theGraphKey,
            formatType: FORMAT_TYPE.PRECISE,
        });
        const startTime = Date.now(); // Record the start time
        const timeout = 60000; // 1 minute timeout
        while ((!betData.bet || !betData.bet.isResolved) && !betData.error) {
            if (Date.now() - startTime >= timeout) {
                throw new Error("Timeout: Bet data retrieval exceeded 1 minute.");
            }
            await new Promise((resolve) => setTimeout(resolve, 1000));
            betData = await fetchBetByHash(txHash, { chainId, theGraphKey });
            if (betData.error) {
                break;
            }
        }
        if (betData.error) {
            throw new Error(`[${betData.error.code}] Error fetching bet: ${betData.error.message}`);
        }
        if (!betData.bet) {
            throw new Error(`The bet hasn't been indexed in time, please retry later: ${txHash}`);
        }
        const bet = betData.bet;
        return {
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
        };
    } catch (error) {
        throw new Error(`An error occured while getting the bet: ${error}`);
    }
}

export async function getCasinoTokens(walletClient: EVMWalletClient): Promise<Token[]> {
    const chainId = walletClient.getChain().id as CasinoChainId;
    const casinoTokensFunctionData = getCasinoTokensFunctionData(chainId);

    const { value: rawCasinoTokens } = (await walletClient.read({
        address: casinoTokensFunctionData.data.to,
        functionName: casinoTokensFunctionData.data.functionName,
        abi: casinoTokensFunctionData.data.abi,
    })) as { value: RawCasinoToken[] };

    return rawCasinoTokens
        .filter((rawToken) => rawToken.token.allowed && !rawToken.token.paused)
        .map((rawToken) => ({
            ...rawTokenToToken(rawToken, chainId),
            decimals: Number(rawToken.decimals),
        }));
}
