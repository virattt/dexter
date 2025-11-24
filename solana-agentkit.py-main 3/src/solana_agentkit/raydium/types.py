# raydium/types.py

from dataclasses import dataclass
from typing import Optional, List, Dict, Union
from solders.pubkey import Pubkey as PublicKey # type: ignore

@dataclass
class AccountMeta:
    """Metadata for an account in a transaction"""
    public_key: Union[PublicKey, str]
    is_signer: bool
    is_writable: bool

@dataclass
class PoolKeys:
    """Keys for a Raydium pool"""
    amm_id: PublicKey
    base_mint: PublicKey
    quote_mint: PublicKey
    base_decimals: int
    quote_decimals: int
    open_orders: PublicKey
    target_orders: PublicKey
    base_vault: PublicKey
    quote_vault: PublicKey
    market_id: PublicKey
    market_authority: PublicKey
    market_base_vault: PublicKey
    market_quote_vault: PublicKey
    bids: PublicKey
    asks: PublicKey
    event_queue: PublicKey

@dataclass
class TokenConfig:
    """Configuration for a token in a pool"""
    mint: PublicKey
    decimals: int
    vault: Optional[PublicKey] = None
    fees_vault: Optional[PublicKey] = None
    oracle: Optional[PublicKey] = None

@dataclass
class SwapParams:
    """Parameters for a swap operation"""
    pool_id: PublicKey
    user: PublicKey
    amount_in: int
    min_amount_out: int
    direction: str  # "a_to_b" or "b_to_a"
    slippage: float
    referrer: Optional[PublicKey] = None

@dataclass
class LiquidityParams:
    """Parameters for liquidity operations"""
    pool_id: PublicKey
    user: PublicKey
    amount_a: int
    amount_b: int
    min_mint_amount: Optional[int] = None
    lp_amount: Optional[int] = None
    min_amount_a: Optional[int] = None
    min_amount_b: Optional[int] = None

@dataclass
class PoolConfig:
    """Configuration for pool creation"""
    token_a: TokenConfig
    token_b: TokenConfig
    fee_rate: int
    initial_price: float
    is_stable: bool = False
    optimal_trade_size: Optional[int] = None
    optimal_offset: Optional[int] = None

@dataclass
class PoolState:
    """State of a Raydium pool"""
    pool_id: PublicKey
    token_a: TokenConfig
    token_b: TokenConfig
    lp_mint: PublicKey
    total_supply: int
    fee_rate: int
    last_updated: int
    status: int
    reserves_a: int
    reserves_b: int
    cumulative_a: int
    cumulative_b: int
    fees_a_total: int
    fees_b_total: int
    price_0_cumulative: int
    price_1_cumulative: int
    
    @classmethod
    def from_layout(cls, data: Dict) -> 'PoolState':
        """Create PoolState from layout data"""
        return cls(
            pool_id=PublicKey.from_string(data["own_address"]),
            token_a=TokenConfig(
                mint=PublicKey.from_string(data["coinMintAddress"]),
                decimals=data["coinDecimals"]
            ),
            token_b=TokenConfig(
                mint=PublicKey.from_string(data["pcMintAddress"]),
                decimals=data["pcDecimals"]
            ),
            lp_mint=PublicKey.from_string(data["lpMintAddress"]),
            total_supply=data["depth"],
            fee_rate=data["tradeFeeNumerator"] / data["tradeFeeDenominator"],
            last_updated=data["poolOpenTime"],
            status=data["status"],
            reserves_a=data["base_deposits_total"],
            reserves_b=data["quote_deposits_total"],
            cumulative_a=data["totalPnlCoin"],
            cumulative_b=data["totalPnlPc"],
            fees_a_total=data["swapCoin2PcFee"],
            fees_b_total=data["swapPc2CoinFee"],
            price_0_cumulative=data["minPriceMultiplier"],
            price_1_cumulative=data["maxPriceMultiplier"]
        )

@dataclass
class MarketState:
    """State of a Serum market associated with a pool"""
    market_id: PublicKey
    base_mint: PublicKey
    quote_mint: PublicKey
    base_vault: PublicKey
    quote_vault: PublicKey
    base_deposits: int
    quote_deposits: int
    base_fees: int
    quote_fees: int
    vault_signer_nonce: int
    base_lot_size: int
    quote_lot_size: int
    fee_rate: int

@dataclass
class PositionInfo:
    """Information about a liquidity position"""
    owner: PublicKey
    pool_id: PublicKey
    lp_amount: int
    token_a_amount: int
    token_b_amount: int
    rewards_owed: int
    fee_growth_checkpoint_a: int
    fee_growth_checkpoint_b: int
    withdrawn_fees_a: int
    withdrawn_fees_b: int
    liquidity_delta: Optional[int] = None

@dataclass
class SwapResult:
    """Result of a swap calculation"""
    amount_in: int
    amount_out: int
    min_amount_out: int
    price_impact: float
    fee_amount: int
    protocol_fee: int
    lp_fee: int

@dataclass
class LiquidityResult:
    """Result of a liquidity calculation"""
    lp_tokens_minted: int
    token_a_used: int
    token_b_used: int
    share_percentage: float
    fee_growth_a: int
    fee_growth_b: int

@dataclass
class PoolStats:
    """Statistics for a pool"""
    volume_24h: int
    fees_24h: int
    tvl: int
    apy: float
    price: float
    price_change_24h: float
    liquidity_a: int
    liquidity_b: int
    transactions_24h: int

def validate_pool_keys(keys: PoolKeys) -> bool:
    """Validate pool keys"""
    try:
        # Check that all required keys are present
        if not all([
            keys.amm_id, keys.base_mint, keys.quote_mint,
            keys.open_orders, keys.target_orders,
            keys.base_vault, keys.quote_vault,
            keys.market_id, keys.market_authority,
            keys.market_base_vault, keys.market_quote_vault,
            keys.bids, keys.asks, keys.event_queue
        ]):
            return False
        
        # Validate decimals
        if not (0 <= keys.base_decimals <= 32 and 0 <= keys.quote_decimals <= 32):
            return False
            
        return True
        
    except Exception:
        return False

def validate_swap_params(params: SwapParams) -> bool:
    """Validate swap parameters"""
    try:
        if params.amount_in <= 0 or params.min_amount_out <= 0:
            return False
            
        if params.direction not in ["a_to_b", "b_to_a"]:
            return False
            
        if not (0 <= params.slippage <= 100):
            return False
            
        return True
        
    except Exception:
        return False