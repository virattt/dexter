from typing import Callable
from goat import Chain, PluginBase
from .wallet import CrossmintWalletService
from .api_client import CrossmintWalletsAPI

class WalletPlugin(PluginBase):
    def __init__(self, client: CrossmintWalletsAPI):
        super().__init__("wallets", [CrossmintWalletService(client)])

    def supports_chain(self, chain: Chain) -> bool:
        return True

def wallets_plugin(client: CrossmintWalletsAPI) -> Callable[[], WalletPlugin]:
    return lambda: WalletPlugin(client)