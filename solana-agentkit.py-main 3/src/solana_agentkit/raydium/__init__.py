# raydium/__init__.py

from typing import Dict, Optional, List, Union, Tuple
from dataclasses import dataclass
from solders.pubkey import Pubkey as PublicKey # type: ignore
from solana.rpc.async_api import AsyncClient
from solana.transaction import Transaction, TransactionInstruction
from solana.rpc.commitment import Commitment
from spl.token.constants import TOKEN_PROGRAM_ID
from spl.token.instructions import get_associated_token_address
from .constants import (
    RAYDIUM_PROGRAM_IDS,
    WSOL,
    RAY_V4,
    RAY_AUTHORITY_V4,
    OPEN_BOOK_PROGRAM,
    SOL_DECIMAL,
    DEFAULT_POOL_CONFIG
)
from .layouts import POOL_STATE_LAYOUT
from .types import (
    PoolState,
    SwapParams,
    LiquidityParams,
    TokenConfig,
    PoolConfig
)
from ..utils.transaction import TransactionBuilder

@dataclass
class RaydiumConfig:
    """Configuration for Raydium integration"""
    rpc_endpoint: str
    program_id: PublicKey
    pool_program_id: PublicKey
    farm_program_id: PublicKey

class RaydiumClient:
    def __init__(
        self,
        connection: AsyncClient,
        network: str = "mainnet-beta",
        custom_config: Optional[RaydiumConfig] = None
    ):
        self.connection = connection
        self.network = network
        
        if custom_config:
            self.config = custom_config
        else:
            program_ids = RAYDIUM_PROGRAM_IDS[network]
            self.config = RaydiumConfig(
                rpc_endpoint=connection._provider.endpoint_uri,
                program_id=PublicKey.from_string(program_ids["amm"]),
                pool_program_id=PublicKey.from_string(program_ids["pool"]),
                farm_program_id=PublicKey.from_string(program_ids["farm"])
            )

    async def get_pool(self, pool_id: PublicKey) -> PoolState:
        try:
            account_info = await self.connection.get_account_info(
                pool_id,
                commitment=Commitment("confirmed")
            )
            if not account_info or not account_info.value:
                raise ValueError(f"Pool {pool_id} not found")
                
            pool_data = POOL_STATE_LAYOUT.parse(account_info.value.data)
            return PoolState.from_layout(pool_data)
            
        except Exception as e:
            raise Exception(f"Failed to get pool info: {str(e)}")

    async def create_pool(
        self,
        token_a: TokenConfig,
        token_b: TokenConfig,
        fee_rate: int = DEFAULT_POOL_CONFIG["default_fee_rate"],
        initial_price: float = None
    ) -> Transaction:
        try:
            # Sort tokens to ensure consistent order
            token_a, token_b = self._sort_tokens(token_a, token_b)
            
            # Create pool configuration
            pool_config = PoolConfig(
                token_a=token_a,
                token_b=token_b,
                fee_rate=fee_rate,
                initial_price=initial_price or 1.0
            )
            
            # Validate configuration
            self._validate_pool_config(pool_config)
            
            # Create pool keys
            pool_keys = await self._derive_pool_keys(pool_config)
            
            # Build transaction
            builder = TransactionBuilder()
            
            # Create pool instruction
            create_pool_ix = await self._create_pool_instruction(
                pool_config=pool_config,
                pool_keys=pool_keys
            )
            builder.add_instruction(create_pool_ix)
            
            # Initialize pool instruction
            init_pool_ix = await self._create_init_pool_instruction(
                pool_config=pool_config,
                pool_keys=pool_keys
            )
            builder.add_instruction(init_pool_ix)
            
            return builder.build()
            
        except Exception as e:
            raise Exception(f"Failed to create pool: {str(e)}")

    async def swap(self, params: SwapParams) -> Transaction:
        try:
            self._validate_swap_params(params)
            pool = await self.get_pool(params.pool_id)
            
            # Get accounts
            user_token_accounts = await self._get_or_create_token_accounts(
                owner=params.user,
                tokens=[pool.token_a_mint, pool.token_b_mint]
            )
            
            # Calculate amounts
            amounts = self._calculate_swap_amounts(
                pool=pool,
                amount_in=params.amount_in,
                min_amount_out=params.min_amount_out,
                swap_direction=params.direction
            )
            
            # Build transaction
            builder = TransactionBuilder()
            
            swap_ix = await self._create_swap_instruction(
                pool=pool,
                user_accounts=user_token_accounts,
                amounts=amounts,
                params=params
            )
            builder.add_instruction(swap_ix)
            
            return builder.build()
            
        except Exception as e:
            raise Exception(f"Failed to create swap: {str(e)}")

    async def add_liquidity(self, params: LiquidityParams) -> Transaction:
        try:
            self._validate_liquidity_params(params)
            pool = await self.get_pool(params.pool_id)
            
            # Get user token accounts
            user_token_accounts = await self._get_or_create_token_accounts(
                owner=params.user,
                tokens=[pool.token_a_mint, pool.token_b_mint]
            )
            
            # Calculate optimal amounts
            optimal_amounts = self._calculate_optimal_liquidity_amounts(
                pool=pool,
                amount_a=params.amount_a,
                amount_b=params.amount_b
            )
            
            # Build transaction
            builder = TransactionBuilder()
            
            add_liquidity_ix = await self._create_add_liquidity_instruction(
                pool=pool,
                user_accounts=user_token_accounts,
                amounts=optimal_amounts,
                params=params
            )
            builder.add_instruction(add_liquidity_ix)
            
            return builder.build()
            
        except Exception as e:
            raise Exception(f"Failed to add liquidity: {str(e)}")

    async def remove_liquidity(self, params: LiquidityParams) -> Transaction:
        try:
            pool = await self.get_pool(params.pool_id)
            
            # Get user token accounts
            user_token_accounts = await self._get_or_create_token_accounts(
                owner=params.user,
                tokens=[pool.token_a_mint, pool.token_b_mint]
            )
            
            # Calculate withdrawal amounts
            withdrawal_amounts = self._calculate_withdrawal_amounts(
                pool=pool,
                lp_amount=params.lp_amount
            )
            
            # Build transaction
            builder = TransactionBuilder()
            
            remove_liquidity_ix = await self._create_remove_liquidity_instruction(
                pool=pool,
                user_accounts=user_token_accounts,
                amounts=withdrawal_amounts,
                params=params
            )
            builder.add_instruction(remove_liquidity_ix)
            
            return builder.build()
            
        except Exception as e:
            raise Exception(f"Failed to remove liquidity: {str(e)}")

    async def get_pools(
        self,
        token_a: Optional[PublicKey] = None,
        token_b: Optional[PublicKey] = None
    ) -> List[PoolState]:
        try:
            # Get program accounts
            accounts = await self.connection.get_program_accounts(
                self.config.pool_program_id,
                commitment=Commitment("confirmed")
            )
            
            pools = []
            for acc in accounts:
                try:
                    pool_data = POOL_STATE_LAYOUT.parse(acc.account.data)
                    pool = PoolState.from_layout(pool_data)
                    
                    # Apply filters
                    if token_a and pool.token_a_mint != token_a:
                        continue
                    if token_b and pool.token_b_mint != token_b:
                        continue
                        
                    pools.append(pool)
                except Exception:
                    continue
            
            return pools
            
        except Exception as e:
            raise Exception(f"Failed to get pools: {str(e)}")

    async def _create_pool_instruction(
        self,
        pool_config: PoolConfig,
        pool_keys: Dict[str, PublicKey]
    ) -> TransactionInstruction:
        """Creates instruction for pool creation"""
        # Implementation of pool creation instruction layout and data
        # This would include the specific instruction data structure required by Raydium
        pass

    async def _create_init_pool_instruction(
        self,
        pool_config: PoolConfig,
        pool_keys: Dict[str, PublicKey]
    ) -> TransactionInstruction:
        """Creates instruction for pool initialization"""
        # Implementation of pool initialization instruction layout and data
        pass

    async def _create_swap_instruction(
        self,
        pool: PoolState,
        user_accounts: Dict[str, PublicKey],
        amounts: Dict[str, int],
        params: SwapParams
    ) -> TransactionInstruction:
        """Creates instruction for swap"""
        # Implementation of swap instruction layout and data
        pass

    async def _create_add_liquidity_instruction(
        self,
        pool: PoolState,
        user_accounts: Dict[str, PublicKey],
        amounts: Dict[str, int],
        params: LiquidityParams
    ) -> TransactionInstruction:
        """Creates instruction for adding liquidity"""
        # Implementation of add liquidity instruction layout and data
        pass

    async def _create_remove_liquidity_instruction(
        self,
        pool: PoolState,
        user_accounts: Dict[str, PublicKey],
        amounts: Dict[str, int],
        params: LiquidityParams
    ) -> TransactionInstruction:
        """Creates instruction for removing liquidity"""
        # Implementation of remove liquidity instruction layout and data
        pass

    async def _derive_pool_keys(self, pool_config: PoolConfig) -> Dict[str, PublicKey]:
        """Derives necessary keys for pool operations"""
        # Implementation of pool key derivation logic
        pass

    async def _get_or_create_token_accounts(
        self,
        owner: PublicKey,
        tokens: List[PublicKey]
    ) -> Dict[str, PublicKey]:
        """Gets or creates associated token accounts"""
        accounts = {}
        for token in tokens:
            ata = get_associated_token_address(owner, token)
            
            # Check if account exists
            info = await self.connection.get_account_info(ata)
            if not info:
                # Add creation instruction if needed
                pass
                
            accounts[str(token)] = ata
            
        return accounts

    def _calculate_swap_amounts(
        self,
        pool: PoolState,
        amount_in: int,
        min_amount_out: int,
        swap_direction: str
    ) -> Dict[str, int]:
        """Calculates swap amounts including fees"""
        # Implementation of swap amount calculation
        pass

    def _calculate_optimal_liquidity_amounts(
        self,
        pool: PoolState,
        amount_a: int,
        amount_b: int
    ) -> Dict[str, int]:
        """Calculates optimal liquidity provision amounts"""
        # Implementation of liquidity amount calculation
        pass

    def _calculate_withdrawal_amounts(
        self,
        pool: PoolState,
        lp_amount: int
    ) -> Dict[str, int]:
        """Calculates withdrawal amounts based on LP tokens"""
        # Implementation of withdrawal amount calculation
        pass

    def _sort_tokens(
        self,
        token_a: TokenConfig,
        token_b: TokenConfig
    ) -> Tuple[TokenConfig, TokenConfig]:
        """Sorts tokens to ensure consistent ordering"""
        if bytes(token_a.mint) > bytes(token_b.mint):
            return token_b, token_a
        return token_a, token_b

    def _validate_pool_config(self, config: PoolConfig) -> None:
        """Validates pool configuration"""
        if not DEFAULT_POOL_CONFIG["min_fee_rate"] <= config.fee_rate <= DEFAULT_POOL_CONFIG["max_fee_rate"]:
            raise ValueError(f"Invalid fee rate: {config.fee_rate}")
            
        if config.initial_price <= 0:
            raise ValueError(f"Invalid initial price: {config.initial_price}")

    def _validate_swap_params(self, params: SwapParams) -> None:
        """Validates swap parameters"""
        if params.amount_in <= 0:
            raise ValueError("Invalid input amount")
        if params.min_amount_out <= 0:
            raise ValueError("Invalid minimum output amount")
        if params.slippage < 0 or params.slippage > DEFAULT_POOL_CONFIG["max_slippage"]:
            raise ValueError(f"Invalid slippage: {params.slippage}")

    def _validate_liquidity_params(self, params: LiquidityParams) -> None:
        """Validates liquidity parameters"""
        if params.amount_a <= 0 or params.amount_b <= 0:
            raise ValueError("Invalid liquidity amounts")