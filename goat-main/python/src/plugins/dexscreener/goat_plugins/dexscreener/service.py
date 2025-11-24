import aiohttp
from goat.decorators.tool import Tool
from .parameters import (
    GetPairsByChainAndPairParameters,
    SearchPairsParameters,
    GetTokenPairsParameters,
)


class DexscreenerService:
    def __init__(self):
        self.base_url = "https://api.dexscreener.com/latest/dex"

    async def _fetch(self, url: str, action: str):
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as response:
                    if not response.ok:
                        raise Exception(f"HTTP error! status: {response.status} {await response.text()}")
                    return await response.json()
        except Exception as e:
            raise Exception(f"Failed to {action}: {e}")

    @Tool({
        "description": "Fetch pairs by chainId and pairId from Dexscreener",
        "parameters_schema": GetPairsByChainAndPairParameters
    })
    async def get_pairs_by_chain_and_pair(self, parameters: dict):
        url = f"{self.base_url}/pairs/{parameters['chainId']}/{parameters['pairId']}"
        return await self._fetch(url, "fetch pairs")

    @Tool({
        "description": "Search for DEX pairs matching a query string on Dexscreener",
        "parameters_schema": SearchPairsParameters
    })
    async def search_pairs(self, parameters: dict):
        query = parameters["query"]
        url = f"{self.base_url}/search?q={query}"
        return await self._fetch(url, "search pairs")

    @Tool({
        "description": "Get all DEX pairs for given token addresses (up to 30) from Dexscreener",
        "parameters_schema": GetTokenPairsParameters
    })
    async def get_token_pairs_by_token_address(self, parameters: dict):
        addresses = ",".join(parameters["tokenAddresses"])
        url = f"{self.base_url}/tokens/{addresses}"
        return await self._fetch(url, "get token pairs")
