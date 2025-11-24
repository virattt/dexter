import { Tool } from "@goat-sdk/core";
import { SolanaWalletClient } from "@goat-sdk/wallet-solana";
import {
    ClosePositionParameters,
    CreateCLMMParameters,
    CreateSingleSidedPoolParameters,
    FetchPositionsByOwnerParameters,
    OpenCenteredPositionParameters,
    OpenSingleSidedPositionParameters,
} from "./parameters";
import { closePosition } from "./tools/closePosition";
import { createCLMM } from "./tools/createCLMM";
import { createSingleSidedPool } from "./tools/createSingleSidedPool";
import { fetchPositionsByOwner } from "./tools/fetchPositionsByOwner";
import { openCenteredPosition } from "./tools/openCenteredPosition";
import { openSingleSidedPosition } from "./tools/openSingleSidedPosition";

export const FEE_TIERS = {
    0.01: 1,
    0.02: 2,
    0.04: 4,
    0.05: 8,
    0.16: 16,
    0.3: 64,
    0.65: 96,
    1.0: 128,
    2.0: 256,
} as const;

export class OrcaService {
    @Tool({
        description: "Closes a Liquidity Position in an Orca Whirlpool.",
    })
    async closePosition(walletClient: SolanaWalletClient, parameters: ClosePositionParameters) {
        return await closePosition(walletClient, parameters);
    }

    @Tool({
        description:
            "Create a concentrated liquidity market maker (CLMM) pool on Orca. This function only initializes a new account with the pool state, but does not open a position with liquidity yet.",
    })
    async createCLMM(walletClient: SolanaWalletClient, parameters: CreateCLMMParameters) {
        return await createCLMM(walletClient, parameters);
    }

    @Tool({
        description:
            "Create a single-sided liquidity pool on the Orca DEX. This function initializes a new pool with liquidity contributed from a single token, allowing users to define an initial price, a maximum price, and other parameters. The function ensures proper mint order and on-chain configuration for seamless execution. Ideal for setting up a pool with minimal price impact, it supports advanced features like adjustable fee tiers and precise initial price settings.",
    })
    async createSingleSidedPool(walletClient: SolanaWalletClient, parameters: CreateSingleSidedPoolParameters) {
        return await createSingleSidedPool(walletClient, parameters);
    }

    @Tool({
        description:
            "Fetches Liquidity Position by owner and returns if the positions are in range and the distance from the current price to the center price of the position in bps.",
    })
    async fetchPositionsByOwner(walletClient: SolanaWalletClient, parameters: FetchPositionsByOwnerParameters) {
        return await fetchPositionsByOwner(walletClient, parameters);
    }

    @Tool({
        description:
            "Add liquidity to a CLMM by opening a centered position in an Orca Whirlpool, the most efficient liquidity pool on Solana.",
    })
    async openCenteredPosition(walletClient: SolanaWalletClient, parameters: OpenCenteredPositionParameters) {
        return await openCenteredPosition(walletClient, parameters);
    }

    @Tool({
        description:
            "Add liquidity to a CLMM by opening a single-sided position in an Orca Whirlpool, the most efficient liquidity pool on Solana.",
    })
    async openSingleSidedPosition(walletClient: SolanaWalletClient, parameters: OpenSingleSidedPositionParameters) {
        return await openSingleSidedPosition(walletClient, parameters);
    }
}
