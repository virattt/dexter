from goat.decorators.tool import Tool
from goat_wallets.evm import EVMWalletClient

from .parameters import RequestFaucetTokensParameters
from .api_client import CrossmintWalletsAPI


class CrossmintFaucetService:
    def __init__(self, api_client: CrossmintWalletsAPI):
        self.api_client = api_client

    @Tool({
        "description": "Request tokens from faucet",
        "parameters_schema": RequestFaucetTokensParameters
    })
    def request_faucet_tokens(self, wallet_client: EVMWalletClient, parameters: dict) -> dict:
        try:
            return self.api_client.request_faucet_tokens(
                parameters["wallet_address"],
                parameters["chain_id"]
            )
        except Exception as error:
            raise Exception(f"Failed to request faucet tokens: {error}")
