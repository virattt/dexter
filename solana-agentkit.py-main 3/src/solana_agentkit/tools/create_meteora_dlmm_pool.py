from math import ceil
from typing import Optional

from solders.pubkey import Pubkey as PublicKey  # type: ignore
from spl.token.client import Token

from solana_agentkit.agent import SolanaAgentKit
from solana_agentkit.utils import meteora_dlmm as DLMM
from solana_agentkit.meteora.types import ActivationType


class MeteoraManager:
    @staticmethod
    async def create_meteora_dlmm_pool(
    agent: SolanaAgentKit,
    bin_step: int,
    token_a_mint: PublicKey,
    token_b_mint: PublicKey,
    initial_price: float,
    price_rounding_up: bool,
    fee_bps: int,
    activation_type: ActivationType,
    has_alpha_vault: bool,
    activation_point: Optional[int]
) -> str:
        """
        Create Meteora DLMM pool.
        
        Args:
            agent: Instance of SolanaAgentKit.
            bin_step: DLMM pool bin step.
            token_a_mint: Mint of Token A.
            token_b_mint: Mint of Token B.
            initial_price: Initial pool price as tokenA/tokenB ratio.
            price_rounding_up: Whether to round up the initial pool price.
            fee_bps: Pool trading fee in basis points.
            activation_type: Pool activation type (Timestamp or Slot).
            has_alpha_vault: Whether the pool has a Meteora alpha vault.
            activation_point: Activation point, depending on activation type, or None if not applicable.
        
        Returns:
            The transaction signature of the initialization.
        """
        connection = agent.connection

        # Fetch token mint info
        token_a_mint_info = await Token.get_mint_info(connection, token_a_mint)
        token_b_mint_info = await Token.get_mint_info(connection, token_b_mint)

        # Compute initial price per lamport
        init_price = DLMM.get_price_per_lamport(
            token_a_mint_info.decimals,
            token_b_mint_info.decimals,
            initial_price
        )

        # Get bin ID for activation
        activate_bin_id = DLMM.get_bin_id_from_price(
            initial_price,
            bin_step,
            not price_rounding_up
        )

        # Create transaction for initializing the pool
        init_pool_tx = await DLMM.create_customizable_permissionless_lb_pair(
            connection=connection,
            bin_step=bin_step,
            token_x=token_a_mint,
            token_y=token_b_mint,
            active_id=int(activate_bin_id),
            fee_bps=fee_bps,
            activation_type=activation_type,
            has_alpha_vault=has_alpha_vault,
            creator_key=agent.wallet_address,
            activation_point=activation_point
        )

        # Send and confirm the transaction
        try:
            tx_signature = await connection.send_and_confirm_transaction(
                init_pool_tx,
                [agent.wallet]
            )
        except Exception as e:
            print(f"Error: {e}")
            raise e

        return tx_signature