

from solders.pubkey import Pubkey # type: ignore
from .helpers import BN

# Base Constants
ILM_BASE = Pubkey.from_string("MFGQxwAmB91SwuYX36okv2Qmdc9aMuHTwWGUrp4AtB1")

# Program IDs for different networks
LBCLMM_PROGRAM_IDS = {
    "devnet": "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo",
    "localhost": "LbVRzDTvBDEcrthxfZ4RL6yiq3uZw8bS6MwtdY6UhFQ",
    "mainnet-beta": "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo",
}

# Bin Array Constants
MAX_BIN_ARRAY_SIZE = BN(70)
BIN_ARRAY_BITMAP_SIZE = BN(512)

# Pool Parameters
MAX_FEE_BPS = 10000  # 100% in basis points
MIN_BIN_STEP = 1      # Minimum bin step (0.01%)
MAX_BIN_STEP = 100    # Maximum bin step (1%)

# Position Parameters
MAX_REWARD_TOKENS = 2
MIN_CONCENTRATED_POSITION_SIZE = 1
MAX_CONCENTRATED_POSITION_SIZE = 70

# Protocol Limits
MAX_SWAP_AMOUNT = BN(2).pow(BN(64)).sub(BN(1))  # u64::MAX
MAX_ACTIVE_ID = BN(887272)
MIN_ACTIVE_ID = BN(-887272)

# Mathematical Constants
SCALE_DECIMALS = 12
SCALE = BN(10).pow(BN(SCALE_DECIMALS))
BASIS_POINT_MAX = 10000

# Fee Parameters
DEFAULT_PROTOCOL_FEE = 20  # 0.2% default protocol fee
HOST_FEE_BPS = 2000       # 20% host fee in basis points
MIN_TOTAL_FEE = 0         # Minimum total fee (0%)
MAX_TOTAL_FEE = 1000      # Maximum total fee (10%)

# Time Constants
SECONDS_PER_DAY = 86400
SECONDS_PER_YEAR = SECONDS_PER_DAY * 365

# Oracle Constants
ORACLE_PRECISION = 15
PRICE_SCALE = BN(10).pow(BN(ORACLE_PRECISION))

# Liquidity Constants
MIN_LIQUIDITY = BN(1000)  # Minimum liquidity requirement
PRECISION_MULTIPLIER = BN(1000000000000)  # 10^12

# Bin Step Presets
BIN_STEP_PRESETS = {
    "very_stable": 1,     # 0.01% - for very stable pairs
    "stable": 5,          # 0.05% - for stable pairs
    "normal": 10,         # 0.10% - for normal pairs
    "volatile": 20,       # 0.20% - for volatile pairs
    "very_volatile": 50   # 0.50% - for very volatile pairs
}

# Parameter Ranges
PARAMETER_RANGES = {
    "bin_step": {
        "min": MIN_BIN_STEP,
        "max": MAX_BIN_STEP,
        "default": BIN_STEP_PRESETS["normal"]
    },
    "fee_bps": {
        "min": MIN_TOTAL_FEE,
        "max": MAX_TOTAL_FEE,
        "default": 20  # 0.2% default fee
    },
    "active_id": {
        "min": int(MIN_ACTIVE_ID),
        "max": int(MAX_ACTIVE_ID)
    }
}

# Error Codes
ERROR_CODES = {
    6000: "InvalidStartBinIndex",
    6001: "InvalidBinId",
    6002: "InvalidBinArray",
    6003: "NonContinuousBinArrays",
    6004: "InvalidPosition",
    6005: "InvalidFeeParameter",
    6006: "InvalidBinStep",
    6007: "RewardNotInitialized",
    6008: "InvalidRewardDuration",
    6009: "InvalidRewardRate",
    6010: "RewardAlreadyInitialized",
    6011: "RewardClosed",
    6012: "InvalidRewardVault",
    6013: "InvalidRewardMint",
    6014: "NonEmptyPosition",
    6015: "ZeroLiquidity",
    6016: "InvalidPosition",
    6017: "InvalidInput",
    6018: "ExceededAmountSlippage",
    6019: "ExceededBinSlippage",
    6020: "InsufficientLiquidity",
    6021: "InsufficientRewardBalance"
}

# Type Definitions
ACCOUNT_TYPES = {
    "LbPair": 0,
    "BinArray": 1,
    "Position": 2,
    "Oracle": 3
}

def get_program_id(network: str) -> Pubkey:
    """Get the program ID for the specified network"""
    program_id = LBCLMM_PROGRAM_IDS.get(network)
    if not program_id:
        raise ValueError(f"Unsupported network: {network}")
    return Pubkey.from_string(program_id)

def validate_bin_step(bin_step: int) -> bool:
    """Validate if bin step is within allowed range"""
    return PARAMETER_RANGES["bin_step"]["min"] <= bin_step <= PARAMETER_RANGES["bin_step"]["max"]

def validate_fee_bps(fee_bps: int) -> bool:
    """Validate if fee in basis points is within allowed range"""
    return PARAMETER_RANGES["fee_bps"]["min"] <= fee_bps <= PARAMETER_RANGES["fee_bps"]["max"]

def get_preset_bin_step(volatility: str) -> int:
    """Get preset bin step based on volatility level"""
    return BIN_STEP_PRESETS.get(volatility, BIN_STEP_PRESETS["normal"])