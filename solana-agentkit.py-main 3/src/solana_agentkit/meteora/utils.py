

from typing import Tuple, Optional
from solders.pubkey import Pubkey as PublicKey # type: ignore
from .helpers import BN
from .constants import (
    BIN_ARRAY_BITMAP_SIZE,
    ILM_BASE,
    MAX_BIN_ARRAY_SIZE,
    BASIS_POINT_MAX
)

class MeteoraError(Exception):
    """Base exception for Meteora-related errors"""
    pass

class BaseFactorError(MeteoraError):
    """Exception for base factor calculation errors"""
    pass

def sort_token_mints(token_x: PublicKey, token_y: PublicKey) -> Tuple[PublicKey, PublicKey]:
    """
    Sorts two token mint public keys and returns them in ascending order.
    
    Args:
        token_x: First token's public key
        token_y: Second token's public key
        
    Returns:
        Tuple of sorted public keys (min_key, max_key)
    """
    min_key, max_key = (token_y, token_x) if bytes(token_x) > bytes(token_y) else (token_x, token_y)
    return min_key, max_key

def derive_customizable_permissionless_lb_pair(
    token_x: PublicKey,
    token_y: PublicKey,
    program_id: PublicKey
) -> Tuple[PublicKey, int]:
    """
    Derives the customizable permissionless LB pair address.
    
    Args:
        token_x: First token's public key
        token_y: Second token's public key
        program_id: Program ID
        
    Returns:
        Tuple of (pair_address, bump_seed)
    """
    min_key, max_key = sort_token_mints(token_x, token_y)
    seeds = [bytes(ILM_BASE), bytes(min_key), bytes(max_key)]
    return PublicKey.find_program_address(seeds, program_id)

def derive_reserve(
    token: PublicKey,
    lb_pair: PublicKey,
    program_id: PublicKey
) -> Tuple[PublicKey, int]:
    """
    Derives the reserve address for a token in a liquidity pair.
    
    Args:
        token: Token's public key
        lb_pair: Liquidity pair address
        program_id: Program ID
        
    Returns:
        Tuple of (reserve_address, bump_seed)
    """
    seeds = [bytes(lb_pair), bytes(token)]
    return PublicKey.find_program_address(seeds, program_id)

def derive_oracle(
    lb_pair: PublicKey,
    program_id: PublicKey
) -> Tuple[PublicKey, int]:
    """
    Derives the oracle address for a liquidity pair.
    
    Args:
        lb_pair: Liquidity pair address
        program_id: Program ID
        
    Returns:
        Tuple of (oracle_address, bump_seed)
    """
    seeds = [b"oracle", bytes(lb_pair)]
    return PublicKey.find_program_address(seeds, program_id)

def derive_bin_array(
    lb_pair: PublicKey,
    index: int,
    program_id: PublicKey
) -> Tuple[PublicKey, int]:
    """
    Derives the bin array address for a given index.
    
    Args:
        lb_pair: Liquidity pair address
        index: Bin array index
        program_id: Program ID
        
    Returns:
        Tuple of (bin_array_address, bump_seed)
    """
    bin_array_bytes = (
        index.to_bytes(8, "little", signed=True)
        if index < 0
        else index.to_bytes(8, "little")
    )
    seeds = [b"bin_array", bytes(lb_pair), bin_array_bytes]
    return PublicKey.find_program_address(seeds, program_id)

def bin_id_to_bin_array_index(bin_id: int) -> int:
    """
    Converts a bin ID to a bin array index.
    
    Args:
        bin_id: Bin identifier
        
    Returns:
        Corresponding bin array index
    """
    div, mod = divmod(bin_id, MAX_BIN_ARRAY_SIZE)
    return div - 1 if bin_id < 0 and mod != 0 else div

def is_overflow_default_bin_array_bitmap(bin_array_index: int) -> bool:
    """
    Checks if a bin array index overflows the default bitmap.
    
    Args:
        bin_array_index: Index to check
        
    Returns:
        True if index overflows, False otherwise
    """
    min_idx, max_idx = internal_bitmap_range()
    return bin_array_index > max_idx or bin_array_index < min_idx

def derive_bin_array_bitmap_extension(
    lb_pair: PublicKey,
    program_id: PublicKey
) -> Tuple[PublicKey, int]:
    """
    Derives the bin array bitmap extension address.
    
    Args:
        lb_pair: Liquidity pair address
        program_id: Program ID
        
    Returns:
        Tuple of (bitmap_extension_address, bump_seed)
    """
    seeds = [b"bitmap", bytes(lb_pair)]
    return PublicKey.find_program_address(seeds, program_id)

def internal_bitmap_range() -> Tuple[int, int]:
    """
    Returns the internal bitmap range.
    
    Returns:
        Tuple of (lower_bin_array_index, upper_bin_array_index)
    """
    lower_idx = -BIN_ARRAY_BITMAP_SIZE
    upper_idx = BIN_ARRAY_BITMAP_SIZE - 1
    return lower_idx, upper_idx

def compute_base_factor_from_fee_bps(bin_step: BN, fee_bps: BN) -> BN:
    """
    Computes the base factor from fee basis points.
    
    Args:
        bin_step: Bin step value
        fee_bps: Fee in basis points
        
    Returns:
        Computed base factor as BN
        
    Raises:
        BaseFactorError: If computation fails or results in invalid values
    """
    U16_MAX = 65535
    
    try:
        # Calculate computed base factor
        computed_base_factor = (fee_bps * BASIS_POINT_MAX) / bin_step
        computed_base_factor_floor = int(computed_base_factor)
        
        # Validation checks
        if computed_base_factor != computed_base_factor_floor:
            if computed_base_factor_floor >= U16_MAX:
                raise BaseFactorError("Base factor overflow: exceeds u16 maximum")
            if computed_base_factor_floor == 0:
                raise BaseFactorError("Base factor underflow: equals zero")
            if computed_base_factor % 1 != 0:
                raise BaseFactorError("Cannot compute exact base factor for given fee bps")
        
        return BN(computed_base_factor_floor)
        
    except Exception as e:
        raise BaseFactorError(f"Base factor computation failed: {str(e)}")

def validate_bin_step(bin_step: int) -> bool:
    """
    Validates if a bin step value is within acceptable range.
    
    Args:
        bin_step: Bin step value to validate
        
    Returns:
        True if valid, False otherwise
    """
    MIN_BIN_STEP = 1
    MAX_BIN_STEP = 100
    return MIN_BIN_STEP <= bin_step <= MAX_BIN_STEP

def compute_price_from_bin_id(bin_id: int, bin_step: int) -> float:
    """
    Computes the price for a given bin ID and step.
    
    Args:
        bin_id: Bin identifier
        bin_step: Bin step value
        
    Returns:
        Computed price
    """
    return (1 + bin_step/10000) ** bin_id

def get_bin_array_range(bin_id: int) -> Tuple[int, int]:
    """
    Gets the range of bin IDs covered by the bin array containing the given bin ID.
    
    Args:
        bin_id: Bin identifier
        
    Returns:
        Tuple of (start_bin_id, end_bin_id)
    """
    array_index = bin_id_to_bin_array_index(bin_id)
    start = array_index * MAX_BIN_ARRAY_SIZE
    end = start + MAX_BIN_ARRAY_SIZE - 1
    return start, end