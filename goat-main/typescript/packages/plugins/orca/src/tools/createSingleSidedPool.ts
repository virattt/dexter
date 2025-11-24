import { BN, Wallet } from "@coral-xyz/anchor";
import { SolanaWalletClient } from "@goat-sdk/wallet-solana";
import { Percentage, TransactionBuilder, resolveOrCreateATAs } from "@orca-so/common-sdk";
import {
    IncreaseLiquidityQuoteParam,
    NO_TOKEN_EXTENSION_CONTEXT,
    ORCA_WHIRLPOOL_PROGRAM_ID,
    PDAUtil,
    PoolUtil,
    PriceMath,
    TickUtil,
    TokenExtensionContextForPool,
    TokenExtensionUtil,
    WhirlpoolContext,
    WhirlpoolIx,
    increaseLiquidityQuoteByInputTokenWithParams,
} from "@orca-so/whirlpools-sdk";
import {
    increaseLiquidityIx,
    increaseLiquidityV2Ix,
    initTickArrayIx,
    openPositionWithTokenExtensionsIx,
} from "@orca-so/whirlpools-sdk/dist/instructions";
import { TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Keypair, PublicKey, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { Decimal } from "decimal.js";
import { FEE_TIERS } from "../orca.service";
import { CreateSingleSidedPoolParameters } from "../parameters";

export async function createSingleSidedPool(
    walletClient: SolanaWalletClient,
    parameters: CreateSingleSidedPoolParameters,
) {
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

    const depositTokenAmount = new BN(Number(parameters.depositTokenAmount));
    const depositTokenMint = new PublicKey(parameters.depositTokenMint);
    const otherTokenMint = new PublicKey(parameters.otherTokenMint);
    let initialPrice = new Decimal(Number(parameters.startPrice));
    let maxPrice = new Decimal(Number(parameters.maxPrice));
    const feeTier = Number(parameters.feeTier) as keyof typeof FEE_TIERS;

    const correctTokenOrder = PoolUtil.orderMints(otherTokenMint, depositTokenMint).map((addr) => addr.toString());
    const isCorrectMintOrder = correctTokenOrder[0] === depositTokenMint.toString();
    let mintA: PublicKey;
    let mintB: PublicKey;
    if (isCorrectMintOrder) {
        [mintA, mintB] = [depositTokenMint, otherTokenMint];
    } else {
        [mintA, mintB] = [otherTokenMint, depositTokenMint];
        initialPrice = new Decimal(1 / initialPrice.toNumber());
        maxPrice = new Decimal(1 / maxPrice.toNumber());
    }
    const mintAAccount = await fetcher.getMintInfo(mintA);
    const mintBAccount = await fetcher.getMintInfo(mintB);
    if (mintAAccount === null || mintBAccount === null) throw Error("Mint account not found");
    const tickSpacing = FEE_TIERS[feeTier];
    const tickIndex = PriceMath.priceToTickIndex(initialPrice, mintAAccount.decimals, mintBAccount.decimals);
    const initialTick = TickUtil.getInitializableTickIndex(tickIndex, tickSpacing);

    const tokenExtensionCtx: TokenExtensionContextForPool = {
        ...NO_TOKEN_EXTENSION_CONTEXT,
        tokenMintWithProgramA: mintAAccount,
        tokenMintWithProgramB: mintBAccount,
    };
    const feeTierKey = PDAUtil.getFeeTier(ORCA_WHIRLPOOL_PROGRAM_ID, whirlpoolsConfigAddress, tickSpacing).publicKey;
    const initSqrtPrice = PriceMath.tickIndexToSqrtPriceX64(initialTick);
    const tokenVaultAKeypair = Keypair.generate();
    const tokenVaultBKeypair = Keypair.generate();
    const whirlpoolPda = PDAUtil.getWhirlpool(
        ORCA_WHIRLPOOL_PROGRAM_ID,
        whirlpoolsConfigAddress,
        mintA,
        mintB,
        FEE_TIERS[feeTier],
    );
    const tokenBadgeA = PDAUtil.getTokenBadge(ORCA_WHIRLPOOL_PROGRAM_ID, whirlpoolsConfigAddress, mintA).publicKey;
    const tokenBadgeB = PDAUtil.getTokenBadge(ORCA_WHIRLPOOL_PROGRAM_ID, whirlpoolsConfigAddress, mintB).publicKey;
    const baseParamsPool = {
        initSqrtPrice,
        whirlpoolsConfig: whirlpoolsConfigAddress,
        whirlpoolPda,
        tokenMintA: mintA,
        tokenMintB: mintB,
        tokenVaultAKeypair,
        tokenVaultBKeypair,
        feeTierKey,
        tickSpacing: tickSpacing,
        funder: walletAddress,
    };
    const initPoolIx = !TokenExtensionUtil.isV2IxRequiredPool(tokenExtensionCtx)
        ? WhirlpoolIx.initializePoolIx(ctx.program, baseParamsPool)
        : WhirlpoolIx.initializePoolV2Ix(ctx.program, {
              ...baseParamsPool,
              tokenProgramA: tokenExtensionCtx.tokenMintWithProgramA.tokenProgram,
              tokenProgramB: tokenExtensionCtx.tokenMintWithProgramB.tokenProgram,
              tokenBadgeA,
              tokenBadgeB,
          });
    const initialTickArrayStartTick = TickUtil.getStartTickIndex(initialTick, tickSpacing);
    const initialTickArrayPda = PDAUtil.getTickArray(
        ctx.program.programId,
        whirlpoolPda.publicKey,
        initialTickArrayStartTick,
    );

    const txBuilder = new TransactionBuilder(ctx.provider.connection, ctx.provider.wallet, ctx.txBuilderOpts);
    txBuilder.addInstruction(initPoolIx);
    txBuilder.addInstruction(
        initTickArrayIx(ctx.program, {
            startTick: initialTickArrayStartTick,
            tickArrayPda: initialTickArrayPda,
            whirlpool: whirlpoolPda.publicKey,
            funder: walletAddress,
        }),
    );

    let tickLowerIndex: number;
    let tickUpperIndex: number;
    if (isCorrectMintOrder) {
        tickLowerIndex = initialTick;
        tickUpperIndex = PriceMath.priceToTickIndex(maxPrice, mintAAccount.decimals, mintBAccount.decimals);
    } else {
        tickLowerIndex = PriceMath.priceToTickIndex(maxPrice, mintAAccount.decimals, mintBAccount.decimals);
        tickUpperIndex = initialTick;
    }
    const tickLowerInitializableIndex = TickUtil.getInitializableTickIndex(tickLowerIndex, tickSpacing);
    const tickUpperInitializableIndex = TickUtil.getInitializableTickIndex(tickUpperIndex, tickSpacing);
    if (
        !TickUtil.checkTickInBounds(tickLowerInitializableIndex) ||
        !TickUtil.checkTickInBounds(tickUpperInitializableIndex)
    )
        throw Error("Prices out of bounds");
    const increasLiquidityQuoteParam: IncreaseLiquidityQuoteParam = {
        inputTokenAmount: depositTokenAmount,
        inputTokenMint: depositTokenMint,
        tokenMintA: mintA,
        tokenMintB: mintB,
        tickCurrentIndex: initialTick,
        sqrtPrice: initSqrtPrice,
        tickLowerIndex: tickLowerInitializableIndex,
        tickUpperIndex: tickUpperInitializableIndex,
        tokenExtensionCtx: tokenExtensionCtx,
        slippageTolerance: Percentage.fromFraction(0, 100),
    };
    const liquidityInput = increaseLiquidityQuoteByInputTokenWithParams(increasLiquidityQuoteParam);
    const { liquidityAmount: liquidity, tokenMaxA, tokenMaxB } = liquidityInput;

    const positionMintKeypair = Keypair.generate();
    const positionMintPubkey = positionMintKeypair.publicKey;
    const positionPda = PDAUtil.getPosition(ORCA_WHIRLPOOL_PROGRAM_ID, positionMintPubkey);
    const positionTokenAccountAddress = getAssociatedTokenAddressSync(
        positionMintPubkey,
        walletAddress,
        ctx.accountResolverOpts.allowPDAOwnerAddress,
        TOKEN_2022_PROGRAM_ID,
    );
    const params = {
        funder: walletAddress,
        owner: walletAddress,
        positionPda,
        positionTokenAccount: positionTokenAccountAddress,
        whirlpool: whirlpoolPda.publicKey,
        tickLowerIndex: tickLowerInitializableIndex,
        tickUpperIndex: tickUpperInitializableIndex,
    };
    const positionIx = openPositionWithTokenExtensionsIx(ctx.program, {
        ...params,
        positionMint: positionMintPubkey,
        withTokenMetadataExtension: true,
    });

    txBuilder.addInstruction(positionIx);
    txBuilder.addSigner(positionMintKeypair);

    const [ataA, ataB] = await resolveOrCreateATAs(
        ctx.connection,
        walletAddress,
        [
            { tokenMint: mintA, wrappedSolAmountIn: tokenMaxA },
            { tokenMint: mintB, wrappedSolAmountIn: tokenMaxB },
        ],
        () => ctx.fetcher.getAccountRentExempt(),
        walletAddress,
        undefined,
        ctx.accountResolverOpts.allowPDAOwnerAddress,
        "ata",
    );
    const { address: tokenOwnerAccountA, ...tokenOwnerAccountAIx } = ataA;
    const { address: tokenOwnerAccountB, ...tokenOwnerAccountBIx } = ataB;

    txBuilder.addInstruction(tokenOwnerAccountAIx);
    txBuilder.addInstruction(tokenOwnerAccountBIx);

    const tickArrayLowerStartIndex = TickUtil.getStartTickIndex(tickLowerInitializableIndex, tickSpacing);
    const tickArrayUpperStartIndex = TickUtil.getStartTickIndex(tickUpperInitializableIndex, tickSpacing);
    const tickArrayLowerPda = PDAUtil.getTickArray(
        ctx.program.programId,
        whirlpoolPda.publicKey,
        tickArrayLowerStartIndex,
    );
    const tickArrayUpperPda = PDAUtil.getTickArray(
        ctx.program.programId,
        whirlpoolPda.publicKey,
        tickArrayUpperStartIndex,
    );
    if (tickArrayUpperStartIndex !== tickArrayLowerStartIndex) {
        if (isCorrectMintOrder) {
            txBuilder.addInstruction(
                initTickArrayIx(ctx.program, {
                    startTick: tickArrayUpperStartIndex,
                    tickArrayPda: tickArrayUpperPda,
                    whirlpool: whirlpoolPda.publicKey,
                    funder: walletAddress,
                }),
            );
        } else {
            txBuilder.addInstruction(
                initTickArrayIx(ctx.program, {
                    startTick: tickArrayLowerStartIndex,
                    tickArrayPda: tickArrayLowerPda,
                    whirlpool: whirlpoolPda.publicKey,
                    funder: walletAddress,
                }),
            );
        }
    }

    const baseParamsLiquidity = {
        liquidityAmount: liquidity,
        tokenMaxA,
        tokenMaxB,
        whirlpool: whirlpoolPda.publicKey,
        positionAuthority: walletAddress,
        position: positionPda.publicKey,
        positionTokenAccount: positionTokenAccountAddress,
        tokenOwnerAccountA,
        tokenOwnerAccountB,
        tokenVaultA: tokenVaultAKeypair.publicKey,
        tokenVaultB: tokenVaultBKeypair.publicKey,
        tickArrayLower: tickArrayLowerPda.publicKey,
        tickArrayUpper: tickArrayUpperPda.publicKey,
    };

    const liquidityIx = !TokenExtensionUtil.isV2IxRequiredPool(tokenExtensionCtx)
        ? increaseLiquidityIx(ctx.program, baseParamsLiquidity)
        : increaseLiquidityV2Ix(ctx.program, {
              ...baseParamsLiquidity,
              tokenMintA: mintA,
              tokenMintB: mintB,
              tokenProgramA: tokenExtensionCtx.tokenMintWithProgramA.tokenProgram,
              tokenProgramB: tokenExtensionCtx.tokenMintWithProgramB.tokenProgram,
          });
    txBuilder.addInstruction(liquidityIx);

    const txPayload = await txBuilder.build();
    const instructions = TransactionMessage.decompile(
        (txPayload.transaction as VersionedTransaction).message,
    ).instructions;

    try {
        const { hash } = await walletClient.sendTransaction({
            instructions: instructions,
            accountsToSign: [positionMintKeypair, tokenVaultAKeypair, tokenVaultBKeypair],
        });
        return hash;
    } catch (error) {
        throw new Error(`Failed to create pool: ${JSON.stringify(error)}`);
    }
}
