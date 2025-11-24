import { Tool } from "@goat-sdk/core";
import { SolanaWalletClient } from "@goat-sdk/wallet-solana";
import DLMM, { StrategyType } from "@meteora-ag/dlmm";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { BN } from "bn.js";
import { CreateDLMMPositionParameters } from "./parameters";

export class MeteoraService {
    @Tool({
        description: "Create a position on the Meteora DEX",
    })
    async createDLMMPosition(walletClient: SolanaWalletClient, parameters: CreateDLMMPositionParameters) {
        const newPosition = new Keypair();
        const user = new PublicKey(walletClient.getAddress());
        const dlmmPool = await this.getDLMM(walletClient, parameters.poolAddress);
        const activeBin = await this.getActiveBin(dlmmPool);
        const activeBinPricePerToken = Number(activeBin.pricePerToken);
        const TOKEN_X_DECIMALS = dlmmPool.tokenX.decimal;
        const TOKEN_Y_DECIMALS = dlmmPool.tokenY.decimal;
        const minBinId = activeBin.binId - 34;
        const maxBinId = activeBin.binId + 34;

        const totalXAmount = new BN(Number(parameters.amount) * 10 ** TOKEN_X_DECIMALS);

        const totalYAmount = new BN(
            Math.floor(Number(parameters.amount) * activeBinPricePerToken * 10 ** TOKEN_Y_DECIMALS),
        );

        const createPositionTx: Transaction = await dlmmPool.initializePositionAndAddLiquidityByStrategy({
            positionPubKey: newPosition.publicKey,
            user: user,
            totalXAmount,
            totalYAmount,
            strategy: {
                maxBinId,
                minBinId,
                strategyType: StrategyType.SpotBalanced,
            },
        });

        try {
            const { hash } = await walletClient.sendTransaction({
                instructions: createPositionTx.instructions,
                accountsToSign: [newPosition],
            });
            return hash;
        } catch (error) {
            throw new Error(`Failed to create position: ${JSON.stringify(error)}`);
        }
    }

    private async getDLMM(walletClient: SolanaWalletClient, poolAddress: string) {
        const dlmmPool = await DLMM.create(walletClient.getConnection(), new PublicKey(poolAddress));
        return dlmmPool;
    }

    private async getActiveBin(dlmmPool: DLMM) {
        const activeBin = await dlmmPool.getActiveBin();
        return activeBin;
    }
}
