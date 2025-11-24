import { Wallet } from "@coral-xyz/anchor";
import { SolanaWalletClient } from "@goat-sdk/wallet-solana";
import { Percentage } from "@orca-so/common-sdk";
import {
    NO_TOKEN_EXTENSION_CONTEXT,
    ORCA_WHIRLPOOL_PROGRAM_ID,
    PriceMath,
    TokenExtensionContextForPool,
    WhirlpoolContext,
    buildWhirlpoolClient,
    increaseLiquidityQuoteByInputToken,
} from "@orca-so/whirlpools-sdk";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { Keypair, PublicKey, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { Decimal } from "decimal.js";
import { OpenSingleSidedPositionParameters } from "../parameters";

export async function openSingleSidedPosition(
    walletClient: SolanaWalletClient,
    parameters: OpenSingleSidedPositionParameters,
) {
    const vanityWallet = new Wallet(new Keypair());
    const ctx = WhirlpoolContext.from(walletClient.getConnection(), vanityWallet, ORCA_WHIRLPOOL_PROGRAM_ID);
    const walletAddress = new PublicKey(walletClient.getAddress());

    const whirlpoolAddress = new PublicKey(parameters.whirlpoolAddress);
    const distanceFromCurrentPriceBps = Number(parameters.distanceFromCurrentPriceBps);
    const widthBps = Number(parameters.widthBps);
    const inputTokenMint = new PublicKey(parameters.inputTokenMint);
    const inputAmount = new Decimal(parameters.inputAmount);
    const client = buildWhirlpoolClient(ctx);

    const whirlpool = await client.getPool(whirlpoolAddress);
    const whirlpoolData = whirlpool.getData();
    const mintInfoA = whirlpool.getTokenAInfo();
    const mintInfoB = whirlpool.getTokenBInfo();
    const price = PriceMath.sqrtPriceX64ToPrice(whirlpoolData.sqrtPrice, mintInfoA.decimals, mintInfoB.decimals);

    const isTokenA = inputTokenMint.equals(mintInfoA.mint);
    let lowerBoundPrice: Decimal;
    let upperBoundPrice: Decimal;
    let lowerTick: number;
    let upperTick: number;
    if (isTokenA) {
        lowerBoundPrice = price.mul(1 + distanceFromCurrentPriceBps / 10000);
        upperBoundPrice = lowerBoundPrice.mul(1 + widthBps / 10000);
        upperTick = PriceMath.priceToInitializableTickIndex(
            upperBoundPrice,
            mintInfoA.decimals,
            mintInfoB.decimals,
            whirlpoolData.tickSpacing,
        );
        lowerTick = PriceMath.priceToInitializableTickIndex(
            lowerBoundPrice,
            mintInfoA.decimals,
            mintInfoB.decimals,
            whirlpoolData.tickSpacing,
        );
    } else {
        lowerBoundPrice = price.mul(1 - distanceFromCurrentPriceBps / 10000);
        upperBoundPrice = lowerBoundPrice.mul(1 - widthBps / 10000);
        lowerTick = PriceMath.priceToInitializableTickIndex(
            upperBoundPrice,
            mintInfoA.decimals,
            mintInfoB.decimals,
            whirlpoolData.tickSpacing,
        );
        upperTick = PriceMath.priceToInitializableTickIndex(
            lowerBoundPrice,
            mintInfoA.decimals,
            mintInfoB.decimals,
            whirlpoolData.tickSpacing,
        );
    }

    const txBuilderTickArrays = await whirlpool.initTickArrayForTicks([lowerTick, upperTick], walletAddress);
    let instructions: TransactionInstruction[] = [];
    let signers: Keypair[] = [];
    if (txBuilderTickArrays !== null) {
        const txPayloadTickArrays = await txBuilderTickArrays.build();
        const txPayloadTickArraysDecompiled = TransactionMessage.decompile(
            (txPayloadTickArrays.transaction as VersionedTransaction).message,
        );
        const instructionsTickArrays = txPayloadTickArraysDecompiled.instructions;
        instructions = instructions.concat(instructionsTickArrays);
        signers = signers.concat(txPayloadTickArrays.signers as Keypair[]);
    }

    const tokenExtensionCtx: TokenExtensionContextForPool = {
        ...NO_TOKEN_EXTENSION_CONTEXT,
        tokenMintWithProgramA: mintInfoA,
        tokenMintWithProgramB: mintInfoB,
    };
    const increaseLiquiditQuote = increaseLiquidityQuoteByInputToken(
        inputTokenMint,
        inputAmount,
        lowerTick,
        upperTick,
        Percentage.fromFraction(1, 100),
        whirlpool,
        tokenExtensionCtx,
    );
    const { positionMint, tx: txBuilder } = await whirlpool.openPositionWithMetadata(
        lowerTick,
        upperTick,
        increaseLiquiditQuote,
        walletAddress,
        walletAddress,
        undefined,
        TOKEN_2022_PROGRAM_ID,
    );
    const txPayload = await txBuilder.build();
    const txPayloadDecompiled = TransactionMessage.decompile((txPayload.transaction as VersionedTransaction).message);
    instructions = instructions.concat(txPayloadDecompiled.instructions);
    signers = signers.concat(txPayload.signers as Keypair[]);

    try {
        const { hash } = await walletClient.sendTransaction({
            instructions: instructions,
            accountsToSign: signers,
        });
        return JSON.stringify({
            transactionId: hash,
            positionMint: positionMint.toString(),
        });
    } catch (error) {
        throw new Error(`Failed to create position: ${JSON.stringify(error)}`);
    }
}
