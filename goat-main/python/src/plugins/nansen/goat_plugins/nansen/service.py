import aiohttp
from goat.decorators.tool import Tool
from .parameters import (
    GetTokenDetailsParameters,
    GetTokenTradesParameters,
    GetNFTDetailsParameters,
    GetNFTTradesParameters,
    GetSmartMoneyParameters,
    GetTradingSignalParameters,
)


class NansenService:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.nansen.ai/v1"

    async def _fetch(self, endpoint: str, action: str, params: dict[str, str] = {}):
        """Helper method to handle HTTP requests with error handling"""
        try:
            url = f"{self.base_url}{endpoint}"
            headers = {"api-key": self.api_key}
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params, headers=headers) as response:
                    if not response.ok:
                        raise Exception(f"HTTP error! status: {response.status} {await response.text()}")
                    return await response.json()
        except Exception as e:
            raise Exception(f"Failed to {action}: {e}")

    @Tool({
        "description": "Get details for a specific token from Nansen",
        "parameters_schema": GetTokenDetailsParameters
    })
    async def get_token_details(self, parameters: dict):
        """Get details for a specific token from Nansen"""
        params = {"address": parameters["address"]}
        return await self._fetch("/token", "get token details", params)

    @Tool({
        "description": "Get trades for a specific token from Nansen",
        "parameters_schema": GetTokenTradesParameters
    })
    async def get_token_trades(self, parameters: dict):
        """Get trades for a specific token from Nansen"""
        params = {
            "address": parameters["address"],
            "start_date": parameters["start_date"],
            "end_date": parameters["end_date"]
        }
        return await self._fetch("/token/dex_trades", "get token trades", params)

    @Tool({
        "description": "Get details for a specific NFT collection or token from Nansen",
        "parameters_schema": GetNFTDetailsParameters
    })
    async def get_nft_details(self, parameters: dict):
        """Get details for a specific NFT collection or token from Nansen"""
        params = {
            "token_address": parameters["token_address"],
            "nft_id": parameters["nft_id"]
        }
        return await self._fetch("/nft", "get NFT details", params)

    @Tool({
        "description": "Get trades for a specific NFT collection or token from Nansen",
        "parameters_schema": GetNFTTradesParameters
    })
    async def get_nft_trades(self, parameters: dict):
        """Get trades for a specific NFT collection or token from Nansen"""
        params = {
            "token_address": parameters["token_address"],
            "nft_id": parameters["nft_id"],
            "start_date": parameters["start_date"],
            "end_date": parameters["end_date"]
        }
        return await self._fetch("/nft/trades", "get NFT trades", params)

    @Tool({
        "description": "Get the flows of tokens associated with smart money addresses",
        "parameters_schema": GetSmartMoneyParameters
    })
    async def get_smart_money_status(self, parameters: dict):
        """Get the flows of tokens associated with smart money addresses"""
        params = {
            "start_date": parameters["start_date"],
            "end_date": parameters["end_date"]
        }
        if parameters.get("token_address"):
            params["token_address"] = parameters["token_address"]
        return await self._fetch("/token_flows", "get smart money status", params)

    @Tool({
        "description": "Get trading signals and alerts based on onchain data and patterns",
        "parameters_schema": GetTradingSignalParameters
    })
    async def get_trading_signal(self, parameters: dict):
        """Get trading signals and alerts based on onchain data and patterns"""
        params = {
            "start_date": parameters["start_date"],
            "end_date": parameters["end_date"]
        }
        if parameters.get("token_address"):
            params["token_address"] = parameters["token_address"]
        return await self._fetch("/signals", "get trading signals", params)
