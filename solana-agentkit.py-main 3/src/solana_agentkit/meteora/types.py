

from enum import Enum, auto
from typing import NamedTuple, Optional
from solders.pubkey import Pubkey # type: ignore
from .helpers import BN

class ActivationType(Enum):
    """Enum for different types of pool activation"""
    Slot = 0
    Timestamp = 1
    
    def __str__(self) -> str:
        return f"{self.name}"
    
    def __repr__(self) -> str:
        return self.name

class PoolStatus(Enum):
    """Pool operational status"""
    Active = auto()
    Inactive = auto()
    Paused = auto()
    Deprecated = auto()

class PositionType(Enum):
    """Types of liquidity positions"""
    Concentrated = auto()
    Distributed = auto()
    SingleSided = auto()

class FeeType(Enum):
    """Types of fees in the protocol"""
    Trading = auto()
    Protocol = auto()
    Host = auto()

class BinStatus(Enum):
    """Status of liquidity bins"""
    Active = auto()
    Inactive = auto()
    Reserved = auto()

class SwapType(Enum):
    """Types of swap operations"""
    ExactIn = auto()
    ExactOut = auto()

class PoolParameters(NamedTuple):
    """Pool initialization parameters"""
    token_x: Pubkey
    token_y: Pubkey
    bin_step: int
    active_id: int
    fee_bps: int
    activation_type: ActivationType
    initial_price: float
    has_alpha_vault: bool = False
    activation_point: Optional[int] = None

class BinRange(NamedTuple):
    """Represents a range of bins"""
    lower: int
    upper: int
    step: int

    def contains(self, bin_id: int) -> bool:
        return self.lower <= bin_id <= self.upper

    def bin_count(self) -> int:
        return (self.upper - self.lower) // self.step + 1

class LiquidityPosition(NamedTuple):
    """Represents a liquidity position"""
    owner: Pubkey
    bin_range: BinRange
    liquidity: BN
    position_type: PositionType
    token_x_amount: BN
    token_y_amount: BN

class SwapParameters(NamedTuple):
    """Parameters for swap operations"""
    amount_in: BN
    min_amount_out: BN
    swap_type: SwapType
    price_impact_tolerance: float
    use_alpha_vault: bool = False

class PoolFees(NamedTuple):
    """Fee structure for a pool"""
    trading_fee_bps: int
    protocol_fee_bps: int
    host_fee_bps: int
    
    def total_fee_bps(self) -> int:
        return self.trading_fee_bps + self.protocol_fee_bps + self.host_fee_bps

    def validate(self) -> bool:
        return self.total_fee_bps() <= 10000  # Max 100%

class BinLiquidity(NamedTuple):
    """Liquidity information for a specific bin"""
    bin_id: int
    x_amount: BN
    y_amount: BN
    supply: BN
    price: float

class PoolState(NamedTuple):
    """Current state of a liquidity pool"""
    address: Pubkey
    parameters: PoolParameters
    status: PoolStatus
    active_bin: int
    total_liquidity: BN
    fees_earned: PoolFees
    last_updated_slot: int

def validate_pool_parameters(params: PoolParameters) -> bool:
    """Validate pool initialization parameters"""
    from .constants import (
        PARAMETER_RANGES,
        validate_bin_step,
        validate_fee_bps
    )
    
    try:
        return all([
            validate_bin_step(params.bin_step),
            validate_fee_bps(params.fee_bps),
            PARAMETER_RANGES["active_id"]["min"] <= params.active_id <= PARAMETER_RANGES["active_id"]["max"],
            params.initial_price > 0
        ])
    except Exception:
        return False

def validate_swap_parameters(params: SwapParameters) -> bool:
    """Validate swap parameters"""
    try:
        return all([
            params.amount_in > BN(0),
            params.min_amount_out > BN(0),
            0 <= params.price_impact_tolerance <= 100  # 0-100%
        ])
    except Exception:
        return False

def calculate_price_from_bin_id(bin_id: int, bin_step: int) -> float:
    """Calculate price from bin ID and step"""
    return (1 + bin_step/10000) ** bin_id