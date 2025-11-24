"""CrossMint wallet implementation for GOAT SDK."""
from typing import Dict, Any, Union

from .api_client import CrossmintWalletsAPI
from .faucet_plugin import faucet_plugin
from .mint_plugin import mint_plugin
from .wallet_plugin import wallets_plugin
from .custodial_solana_wallet import custodial_factory
from .evm_smart_wallet import EVMSmartWalletClient
from .solana_smart_wallet import SolanaSmartWalletClient
from .evm_smart_wallet import smart_wallet_factory as evm_smart_wallet_factory
from .solana_smart_wallet_factory import SolanaSmartWalletFactory


def crossmint(api_key: str) -> Dict[str, Any]:
    """Initialize CrossMint SDK with API key.

    Args:
        api_key: CrossMint API key

    Returns:
        Dict containing CrossMint wallet and plugin factories
    """
    api_client = CrossmintWalletsAPI(api_key=api_key)

    return {
        "custodial": custodial_factory(api_client),
        "evm_smartwallet": evm_smart_wallet_factory(api_client),
        "solana_smartwallet": SolanaSmartWalletFactory(api_client),
        "faucet": faucet_plugin(api_client),
        "mint": mint_plugin(api_client),
        "wallets": wallets_plugin(api_client)
    }


__all__ = [
    "crossmint",
    "EVMSmartWalletClient",
    "SolanaSmartWalletClient",
]
