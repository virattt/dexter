"""CoinGecko plugin wrapper for Dark Dexter."""

from typing import Dict, Any


class CoinGeckoWrapper:
    """Wrapper for CoinGecko GOAT plugin."""
    
    @staticmethod
    def get_price(token_id: str) -> Dict[str, Any]:
        """
        Get token price from CoinGecko.
        
        Args:
            token_id: CoinGecko token ID
            
        Returns:
            Price data including USD value and market cap
        
        Note:
            Use GOATPluginManager with wallet for actual on-chain tools
        """
        return {
            "info": "Use GOATPluginManager.get_market_data_tools() for CoinGecko integration",
            "token_id": token_id
        }
