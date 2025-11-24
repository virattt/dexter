from typing import Dict, Optional, Any
from .types import LinkedUser
from .api_client import CrossmintWalletsAPI


def get_locator(address: Optional[str] = None, linked_user: Optional[LinkedUser] = None, wallet_type: str = "") -> str:
    """Get wallet locator from address or linked user.
    
    Args:
        address: Optional wallet address
        linked_user: Optional linked user info
        wallet_type: Wallet type suffix (e.g. 'evm-smart-wallet', 'solana-smart-wallet')
    """
    if linked_user:
        suffix = f":{wallet_type}" if wallet_type else ""
        if "email" in linked_user:
            return f"email:{linked_user['email']}{suffix}"
        if "phone" in linked_user:
            return f"phone:{linked_user['phone']}{suffix}"
        if "userId" in linked_user:
            return f"userId:{linked_user['userId']}{suffix}"
    
    if not address:
        raise ValueError("A wallet address is required if no linked user is provided")
    
    return address


class BaseWalletClient:
    """Base class for Crossmint wallet implementations."""
    
    def __init__(
        self,
        address: str,
        api_client: CrossmintWalletsAPI,
        chain: str
    ):
        """Initialize base wallet client.
        
        Args:
            address: Wallet address
            api_client: Crossmint API client
            chain: Chain identifier
        """
        self._address = address
        self._client = api_client
        self._chain = chain
        self._locator = get_locator(address, None, "")
    
    def get_address(self) -> str:
        """Get wallet address."""
        return self._address
