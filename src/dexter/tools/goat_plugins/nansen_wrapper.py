"""Nansen plugin wrapper for Dark Dexter."""

from typing import Dict, Any


class NansenWrapper:
    """Wrapper for Nansen GOAT plugin for on-chain analytics."""
    
    @staticmethod
    def get_analytics(address: str) -> Dict[str, Any]:
        """
        Get on-chain analytics from Nansen.
        
        Args:
            address: Wallet or token address
            
        Returns:
            Analytics data including smart money flows
        
        Note:
            Use GOATPluginManager with wallet for actual on-chain tools
        """
        return {
            "info": "Use GOATPluginManager.get_security_tools() for Nansen integration",
            "address": address
        }
