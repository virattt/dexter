# constants.py

from typing import Dict, Final, Optional
from dataclasses import dataclass
from solders.pubkey import Pubkey # type: ignore


class TokenAddresses:
    """
    Common token addresses used across the toolkit.
    
    These addresses represent the official mint addresses for various tokens
    on the Solana blockchain. They are used for token identification and
    interaction throughout the application.
    """
    
    # Stablecoins
    USDC: Final[Pubkey] = Pubkey.from_string("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
    USDT: Final[Pubkey] = Pubkey.from_string("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB")
    USDS: Final[Pubkey] = Pubkey.from_string("USDSwr9ApdHk5bvJKMjzff41FfuX8bSxdKcR81vTwcA")
    
    # Native and Wrapped Tokens
    SOL: Final[Pubkey] = Pubkey.from_string("So11111111111111111111111111111111111111112")
    JITO_SOL: Final[Pubkey] = Pubkey.from_string("J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn")
    B_SOL: Final[Pubkey] = Pubkey.from_string("bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1")
    M_SOL: Final[Pubkey] = Pubkey.from_string("mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So")
    
    # Other Tokens
    BONK: Final[Pubkey] = Pubkey.from_string("DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263")

    @classmethod
    def get_by_symbol(cls, symbol: str) -> Optional[Pubkey]:
        """
        Get token address by symbol
        
        Args:
            symbol: Token symbol (e.g. 'USDC', 'SOL')
            
        Returns:
            Pubkey if found, None otherwise
        """
        return getattr(cls, symbol.upper(), None)

    @classmethod
    def all_tokens(cls) -> Dict[str, Pubkey]:
        """
        Get dictionary of all token addresses
        
        Returns:
            Dictionary mapping token symbols to addresses
        """
        return {
            name: value for name, value in vars(cls).items() 
            if isinstance(value, Pubkey)
        }


@dataclass(frozen=True)
class DefaultOptions:
    """
    Default configuration options for the toolkit.
    
    Attributes:
        SLIPPAGE_BPS: Default slippage tolerance in basis points (300 = 3%)
        TOKEN_DECIMALS: Default number of decimals for new tokens
        COMMITMENT_LEVEL: Default commitment level for transactions
        MAX_RETRIES: Maximum number of transaction retry attempts
        RETRY_DELAY: Delay between retries in seconds
        PRIORITY_FEE: Default priority fee in lamports
    """
    
    # Transaction Parameters
    SLIPPAGE_BPS: int = 300
    TOKEN_DECIMALS: int = 9
    COMMITMENT_LEVEL: str = "confirmed"
    MAX_RETRIES: int = 3
    RETRY_DELAY: int = 1
    
    # Fee Parameters
    PRIORITY_FEE: int = 5000
    DEFAULT_FEE_BPS: int = 30  # 0.3%
    MAX_FEE_BPS: int = 300    # 3%
    
    # Gas Limits
    MAX_COMPUTE_UNITS: int = 200_000
    TARGET_COMPUTE_UNITS: int = 150_000
    
    # RPC Parameters
    TIMEOUT: int = 30
    BATCH_SIZE: int = 100


class APIEndpoints:
    """
    API endpoints used by the toolkit.
    
    These endpoints are used for various service integrations including
    Jupiter for trading and LULO (formerly Flexlend) for lending operations.
    """
    
    # Trading APIs
    JUPITER: Final[str] = "https://quote-api.jup.ag/v6"
    RAYDIUM: Final[str] = "https://api.raydium.io/v2"
    ORCA: Final[str] = "https://api.orca.so"
    
    # Lending APIs
    LULO: Final[str] = "https://api.flexlend.fi"
    SOLEND: Final[str] = "https://api.solend.fi"
    
    # Price APIs
    PYTH: Final[str] = "https://api.pyth.network"
    SWITCHBOARD: Final[str] = "https://api.switchboard.xyz"
    
    @classmethod
    def get_endpoint(cls, service: str) -> Optional[str]:
        """Get API endpoint by service name"""
        return getattr(cls, service.upper(), None)


class NetworkConstants:
    """Network-related constants"""
    
    LAMPORTS_PER_SOL: int = 1_000_000_000
    DEFAULT_DECIMALS: int = 9
    
    # Program IDs
    TOKEN_PROGRAM_ID: Final[Pubkey] = Pubkey.from_string(
        "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
    )
    ASSOCIATED_TOKEN_PROGRAM_ID: Final[Pubkey] = Pubkey.from_string(
        "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
    )
    SYSTEM_PROGRAM_ID: Final[Pubkey] = Pubkey.from_string(
        "11111111111111111111111111111111"
    )
    
    # Common Programs
    MEMO_PROGRAM_ID: Final[Pubkey] = Pubkey.from_string(
        "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
    )


# Create singleton instances for easy access
TOKENS = TokenAddresses()
OPTIONS = DefaultOptions()
APIS = APIEndpoints()
NETWORK = NetworkConstants()

# Type hints
TokenDict = Dict[str, Pubkey]


def get_token_by_symbol(symbol: str) -> Optional[Pubkey]:
    """
    Get a token's Pubkey by its symbol.
    
    Args:
        symbol: Token symbol (e.g., 'USDC', 'SOL')
        
    Returns:
        Pubkey for the specified token or None if not found
    """
    return TOKENS.get_by_symbol(symbol)


def validate_slippage(slippage_bps: int) -> bool:
    """
    Validate slippage is within acceptable range
    
    Args:
        slippage_bps: Slippage in basis points
        
    Returns:
        True if valid, False otherwise
    """
    return 0 < slippage_bps <= OPTIONS.MAX_FEE_BPS


def format_token_amount(amount: int, decimals: int = NETWORK.DEFAULT_DECIMALS) -> float:
    """
    Format raw token amount with decimals
    
    Args:
        amount: Raw token amount
        decimals: Token decimals
        
    Returns:
        Formatted amount as float
    """
    return amount / (10 ** decimals)


def unformat_token_amount(amount: float, decimals: int = NETWORK.DEFAULT_DECIMALS) -> int:
    """
    Convert decimal token amount to raw value
    
    Args:
        amount: Decimal token amount
        decimals: Token decimals
        
    Returns:
        Raw token amount as integer
    """
    return int(amount * (10 ** decimals))