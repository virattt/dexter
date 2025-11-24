import { Wallet } from "@coral-xyz/anchor";
import { SolanaWalletClient } from "@goat-sdk/wallet-solana";
import {
    ORCA_WHIRLPOOL_PROGRAM_ID,
    PoolUtil,
    PriceMath,
    WhirlpoolContext,
    buildWhirlpoolClient,
} from "@orca-so/whirlpools-sdk";
import { Keypair, PublicKey, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { Decimal } from "decimal.js";
import { FEE_TIERS } from "../orca.service";
import { CreateCLMMParameters } from "../parameters";

export async function createCLMM(walletClient: SolanaWalletClient, parameters: CreateCLMMParameters) {
    let whirlpoolsConfigAddress: PublicKey;
    if (walletClient.getConnection().rpcEndpoint.includes("mainnet")) {
        whirlpoolsConfigAddress = new PublicKey("2LecshUwdy9xi7meFgHtFJQNSKk4KdTrcpvaB56dP2NQ");
    } else if (walletClient.getConnection().rpcEndpoint.includes("devnet")) {
        whirlpoolsConfigAddress = new PublicKey("FcrweFY1G9HJAHG5inkGB6pKg1HZ6x9UC2WioAfWrGkR");
    } else {
        throw new Error("Unsupported network");
    }
    const vanityWallet = new Wallet(new Keypair());
    const ctx = WhirlpoolContext.from(walletClient.getConnection(), vanityWallet, ORCA_WHIRLPOOL_PROGRAM_ID);
    const fetcher = ctx.fetcher;
    const walletAddress = new PublicKey(walletClient.getAddress());

    const mintDeploy = new PublicKey(parameters.mintDeploy);
    const mintPair = new PublicKey(parameters.mintPair);
    let initialPrice = new Decimal(parameters.initialPrice);
    const feeTier = Number(parameters.feeTier) as keyof typeof FEE_TIERS;
    const client = buildWhirlpoolClient(ctx);

    const correctTokenOrder = PoolUtil.orderMints(mintDeploy, mintPair).map((addr) => addr.toString());
    const isCorrectMintOrder = correctTokenOrder[0] === mintDeploy.toString();
    let mintA: PublicKey;
    let mintB: PublicKey;
    if (!isCorrectMintOrder) {
        [mintA, mintB] = [mintPair, mintDeploy];
        initialPrice = new Decimal(1 / initialPrice.toNumber());
    } else {
        [mintA, mintB] = [mintDeploy, mintPair];
    }
    const mintAAccount = await fetcher.getMintInfo(mintA);
    const mintBAccount = await fetcher.getMintInfo(mintB);
    if (mintAAccount === null || mintBAccount === null) {
        throw Error("Mint account not found");
    }

    const tickSpacing = FEE_TIERS[feeTier];
    const initialTick = PriceMath.priceToInitializableTickIndex(
        initialPrice,
        mintAAccount.decimals,
        mintBAccount.decimals,
        tickSpacing,
    );
    const { poolKey, tx: txBuilder } = await client.createPool(
        whirlpoolsConfigAddress,
        mintA,
        mintB,
        tickSpacing,
        initialTick,
        walletAddress,
    );

    const txPayload = await txBuilder.build();
    const txPayloadDecompiled = TransactionMessage.decompile((txPayload.transaction as VersionedTransaction).message);
    const instructions = txPayloadDecompiled.instructions;
    const signers = txPayload.signers as Keypair[];

    try {
        const { hash } = await walletClient.sendTransaction({
            instructions: instructions,
            accountsToSign: signers,
        });
        return JSON.stringify({
            transactionId: hash,
            whirlpoolAddress: poolKey.toString(),
        });
    } catch (error) {
        throw new Error(`Failed to create pool: ${JSON.stringify(error)}`);
    }
}
