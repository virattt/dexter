# src/solana_agentkit/constants/tokens.py

from dataclasses import dataclass
from typing import Dict, Final

from rsa import PublicKey


@dataclass(frozen=True)
class TokenAddresses:
    """Common token addresses used across the toolkit."""
    
    # Stablecoins
    USDC: Final[PublicKey] = PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
    USDT: Final[PublicKey] = PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB")
    USDS: Final[PublicKey] = PublicKey("USDSwr9ApdHk5bvJKMjzff41FfuX8bSxdKcR81vTwcA")
    
    # Native SOL and Liquid Staking Derivatives
    SOL: Final[PublicKey] = PublicKey("So11111111111111111111111111111111111111112")
    JITO_SOL: Final[PublicKey] = PublicKey("J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn")
    B_SOL: Final[PublicKey] = PublicKey("bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1")
    M_SOL: Final[PublicKey] = PublicKey("mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So")
    
    # Meme Tokens
    BONK: Final[PublicKey] = PublicKey("DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263")

@dataclass(frozen=True)
class DefaultOptions:
    """Default configuration options."""
    
    # Default slippage tolerance in basis points (300 = 3%)
    SLIPPAGE_BPS: Final[int] = 300
    
    # Default number of decimals for new tokens
    TOKEN_DECIMALS: Final[int] = 9

@dataclass(frozen=True)
class APIEndpoints:
    """API endpoints used by the toolkit."""
    
    # Jupiter API endpoint
    JUPITER: Final[str] = "https://quote-api.jup.ag/v6"
    
    # LULO (formerly Flexlend) API endpoint
    LULO: Final[str] = "https://api.flexlend.fi"

# Create singleton instances
TOKENS = TokenAddresses()
OPTIONS = DefaultOptions()
APIS = APIEndpoints()

# Type hints
TokenDict = Dict[str, PublicKey]

def get_token_by_symbol(symbol: str) -> PublicKey:
    """
    Get a token's PublicKey by its symbol.
    
    Args:
        symbol: Token symbol (e.g., 'USDC', 'SOL')
        
    Returns:
        PublicKey for the specified token
        
    Raises:
        AttributeError: If token symbol is not found
    """
    return getattr(TOKENS, symbol.upper())

def is_stable_coin(token: PublicKey) -> bool:
    """
    Check if a token is a stablecoin.
    
    Args:
        token: Token's PublicKey
        
    Returns:
        True if token is a stablecoin, False otherwise
    """
    stables = {TOKENS.USDC, TOKENS.USDT, TOKENS.USDS}
    return token in stables

def is_lsd(token: PublicKey) -> bool:
    """
    Check if a token is a Liquid Staking Derivative.
    
    Args:
        token: Token's PublicKey
        
    Returns:
        True if token is an LSD, False otherwise
    """
    lsds = {TOKENS.JITO_SOL, TOKENS.B_SOL, TOKENS.M_SOL}
    return token in lsds

class TokenInfo:
    """Helper class for token information."""
    
    @staticmethod
    def get_decimals(token: PublicKey) -> int:
        """Get the number of decimals for a token."""
        decimals_map = {
            str(TOKENS.USDC): 6,
            str(TOKENS.USDT): 6,
            str(TOKENS.USDS): 6,
            str(TOKENS.SOL): 9,
            str(TOKENS.JITO_SOL): 9,
            str(TOKENS.B_SOL): 9,
            str(TOKENS.M_SOL): 9,
            str(TOKENS.BONK): 5,
        }
        return decimals_map.get(str(token), 9)  # Default to 9 decimals
    
    @staticmethod
    def get_name(token: PublicKey) -> str:
        """Get the display name for a token."""
        names_map = {
            str(TOKENS.USDC): "USD Coin",
            str(TOKENS.USDT): "Tether USD",
            str(TOKENS.USDS): "USD Stable",
            str(TOKENS.SOL): "Solana",
            str(TOKENS.JITO_SOL): "Jito Staked SOL",
            str(TOKENS.B_SOL): "Blazestake SOL",
            str(TOKENS.M_SOL): "Marinade SOL",
            str(TOKENS.BONK): "Bonk",
        }
        return names_map.get(str(token), "Unknown Token")