# raydium/constants.py

from solders.pubkey import Pubkey # type: ignore
from typing import Dict, Any

# Core Token Addresses
WSOL = Pubkey.from_string("So11111111111111111111111111111111111111112")
RAY_V4 = Pubkey.from_string("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8")

# Program IDs
TOKEN_PROGRAM_ID = Pubkey.from_string("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
OPEN_BOOK_PROGRAM = Pubkey.from_string("srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX")

# Authority Addresses
RAY_AUTHORITY_V4 = Pubkey.from_string("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1")

# Network-specific Program IDs
RAYDIUM_PROGRAM_IDS: Dict[str, Dict[str, str]] = {
    "mainnet-beta": {
        "amm": "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
        "pool": "7quYw4KcKGMvSbz2cBBPJ9zUXViZpkTHs7UUNbyPwzX7",
        "farm": "EhhTKczWMGQt46ynNeRX1WfeagwwJd7ufHvCDjRxjo5Q"
    },
    "devnet": {
        "amm": "DnXyn8dAR5fJdqfBQciQ6gPSDNMQSTkQrPsR65ZF5qoW",
        "pool": "7quYw4KcKGMvSbz2cBBPJ9zUXViZpkTHs7UUNbyPwzX7",
        "farm": "EhhTKczWMGQt46ynNeRX1WfeagwwJd7ufHvCDjRxjo5Q"
    }
}

# Computational Constants
SOL_DECIMAL = 1e9
UNIT_BUDGET = 100_000
UNIT_PRICE = 1_000_000

# Pool Configuration
DEFAULT_POOL_CONFIG = {
    "min_size": 1_000,              # Minimum pool size
    "max_slippage": 100,            # 1% max slippage
    "min_fee_rate": 1,              # 0.01% minimum fee
    "max_fee_rate": 300,            # 3% maximum fee
    "default_fee_rate": 30,         # 0.3% default fee
    "min_delay": 0,                 # Minimum trade delay
    "max_delay": 300                # Maximum trade delay (5 minutes)
}

# AMM Parameters
AMM_CONSTANTS = {
    "trade_fee_numerator": 25,
    "trade_fee_denominator": 10000,
    "owner_trade_fee_numerator": 5,
    "owner_trade_fee_denominator": 10000,
    "owner_withdraw_fee_numerator": 0,
    "owner_withdraw_fee_denominator": 0,
    "host_fee_numerator": 20,
    "host_fee_denominator": 100
}

# Transaction Limits
TRANSACTION_LIMITS = {
    "max_tokens_in": 50,            # Maximum tokens in a transaction
    "max_accounts": 64,             # Maximum accounts in a transaction
    "max_compute_units": 200_000    # Maximum compute units
}

# Fee Structure
FEE_STRUCTURE = {
    "trading_fee": 0.0025,          # 0.25% trading fee
    "protocol_fee": 0.0005,         # 0.05% protocol fee
    "referral_fee": 0.0005          # 0.05% referral fee
}

# Pool Types
POOL_TYPES = {
    "CONSTANT_PRODUCT": 0,
    "STABLE": 1,
    "WEIGHTED": 2
}

# Error Codes
ERROR_CODES = {
    6000: "InvalidInputAmount",
    6001: "InvalidOutputAmount",
    6002: "InsufficientLiquidity",
    6003: "SlippageExceeded",
    6004: "InvalidFeeRate",
    6005: "PoolNotFound",
    6006: "InvalidPoolType",
    6007: "InvalidTokenAccount",
    6008: "InvalidAuthority"
}

# Precision and Scaling
PRECISION = {
    "price_tick": 1e6,              # Price precision
    "quantity_tick": 1e6,           # Quantity precision
    "fee_rate_tick": 1e4,           # Fee rate precision (basis points)
    "percentage_tick": 1e4          # Percentage precision
}

def get_program_id(network: str, program_type: str) -> str:
    """Get program ID for specific network and program type"""
    if network not in RAYDIUM_PROGRAM_IDS:
        raise ValueError(f"Unsupported network: {network}")
    if program_type not in RAYDIUM_PROGRAM_IDS[network]:
        raise ValueError(f"Unsupported program type: {program_type}")
    return RAYDIUM_PROGRAM_IDS[network][program_type]

def calculate_fee(amount: int, fee_rate: int = DEFAULT_POOL_CONFIG["default_fee_rate"]) -> int:
    """Calculate fee amount based on input amount and fee rate"""
    return int(amount * fee_rate / 10000)  # fee_rate in basis points

def validate_fee_rate(fee_rate: int) -> bool:
    """Validate if fee rate is within allowed range"""
    return DEFAULT_POOL_CONFIG["min_fee_rate"] <= fee_rate <= DEFAULT_POOL_CONFIG["max_fee_rate"]

def get_pool_type_name(pool_type: int) -> str:
    """Get pool type name from pool type ID"""
    return next((k for k, v in POOL_TYPES.items() if v == pool_type), "UNKNOWN")