"""GOAT SDK Plugin Manager for Dark Dexter.

Provides unified access to all GOAT SDK plugins:
- CoinGecko: Token price data and market information
- DexScreener: DEX trading data and analytics
- Rugcheck: Solana token security validation
- Nansen: On-chain analytics and insights
- Jupiter: Token swaps on Solana
- Lulo: USDC yield deposits
"""

from .manager import GOATPluginManager
from .coingecko_wrapper import CoinGeckoWrapper
from .dexscreener_wrapper import DexScreenerWrapper
from .rugcheck_wrapper import RugcheckWrapper
from .nansen_wrapper import NansenWrapper

__all__ = [
    "GOATPluginManager",
    "CoinGeckoWrapper",
    "DexScreenerWrapper",
    "RugcheckWrapper",
    "NansenWrapper",
]
