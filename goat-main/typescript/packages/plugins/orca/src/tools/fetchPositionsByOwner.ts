import { Wallet } from "@coral-xyz/anchor";
import { SolanaWalletClient } from "@goat-sdk/wallet-solana";
import {
    ORCA_WHIRLPOOL_PROGRAM_ID,
    PriceMath,
    WhirlpoolContext,
    buildWhirlpoolClient,
    getAllPositionAccountsByOwner,
} from "@orca-so/whirlpools-sdk";
import { Keypair } from "@solana/web3.js";
import { FetchPositionsByOwnerParameters } from "../parameters";

interface PositionInfo {
    positionMintAddress: string;
    whirlpoolAddress: string;
    positionInRange: boolean;
    distanceFromCenterBps: number;
}

type PositionDataMap = {
    [positionMintAddress: string]: PositionInfo;
};

export async function fetchPositionsByOwner(
    walletClient: SolanaWalletClient,
    parameters: FetchPositionsByOwnerParameters,
) {
    const vanityWallet = new Wallet(new Keypair());
    const ctx = WhirlpoolContext.from(walletClient.getConnection(), vanityWallet, ORCA_WHIRLPOOL_PROGRAM_ID);
    const client = buildWhirlpoolClient(ctx);
    const owner = parameters.owner || walletClient.getAddress();

    const positions = await getAllPositionAccountsByOwner({
        ctx,
        owner: owner,
    });
    const positionDatas = [...positions.positions.entries(), ...positions.positionsWithTokenExtensions.entries()];
    const result: PositionDataMap = {};
    for (const [_, positionData] of positionDatas) {
        const positionMintAddress = positionData.positionMint;
        const whirlpoolAddress = positionData.whirlpool;
        const whirlpool = await client.getPool(whirlpoolAddress);
        const whirlpoolData = whirlpool.getData();
        const sqrtPrice = whirlpoolData.sqrtPrice;
        const currentTick = whirlpoolData.tickCurrentIndex;
        const mintA = whirlpool.getTokenAInfo();
        const mintB = whirlpool.getTokenBInfo();
        const currentPrice = PriceMath.sqrtPriceX64ToPrice(sqrtPrice, mintA.decimals, mintB.decimals);
        const lowerTick = positionData.tickLowerIndex;
        const upperTick = positionData.tickUpperIndex;
        const lowerPrice = PriceMath.tickIndexToPrice(lowerTick, mintA.decimals, mintB.decimals);
        const upperPrice = PriceMath.tickIndexToPrice(upperTick, mintA.decimals, mintB.decimals);
        const centerPosition = lowerPrice.add(upperPrice).div(2);

        const positionInRange = !!(currentTick > lowerTick && currentTick < upperTick);
        const distanceFromCenterBps = Math.ceil(
            currentPrice.sub(centerPosition).abs().div(centerPosition).mul(10000).toNumber(),
        );

        result[positionMintAddress.toString()] = {
            positionMintAddress: positionMintAddress.toString(),
            whirlpoolAddress: whirlpoolAddress.toString(),
            positionInRange,
            distanceFromCenterBps,
        };
    }
    return JSON.stringify(result);
}
