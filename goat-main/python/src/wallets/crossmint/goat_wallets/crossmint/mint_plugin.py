from typing import Callable
from goat import Chain, PluginBase
from .mint import CrossmintMintService
from .api_client import CrossmintWalletsAPI
from .chains import is_chain_supported_by_minting

class MintPlugin(PluginBase):
    def __init__(self, client: CrossmintWalletsAPI):
        super().__init__("mint", [CrossmintMintService(client)])

    def supports_chain(self, chain: Chain) -> bool:
        if chain["type"] == "evm":
            return is_chain_supported_by_minting(chain["id"] or 0)
        return chain["type"] in ["aptos", "solana"]

def mint_plugin(client: CrossmintWalletsAPI) -> Callable[[], MintPlugin]:
    return lambda: MintPlugin(client)