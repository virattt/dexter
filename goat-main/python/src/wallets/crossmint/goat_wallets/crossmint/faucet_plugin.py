from typing import Callable
from goat import Chain, PluginBase
from .faucet import CrossmintFaucetService
from .api_client import CrossmintWalletsAPI
from .chains import is_chain_supported_by_faucet

class FaucetPlugin(PluginBase):
    def __init__(self, client: CrossmintWalletsAPI):
        super().__init__("faucet", [CrossmintFaucetService(client)])

    def supports_chain(self, chain: Chain) -> bool:
        if chain["type"] != "evm":
            return False
        if not chain["id"]:
            return False
        return is_chain_supported_by_faucet(chain["id"])

def faucet_plugin(client: CrossmintWalletsAPI) -> Callable[[], FaucetPlugin]:
    return lambda: FaucetPlugin(client)