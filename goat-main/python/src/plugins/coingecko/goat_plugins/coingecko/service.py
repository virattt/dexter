import aiohttp
from goat.decorators.tool import Tool
from .parameters import GetCoinPriceParameters, GetTrendingCoinsParameters, SearchCoinsParameters

class CoinGeckoService:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.coingecko.com/api/v3"

    @Tool({
        "description": "Get the list of trending coins from CoinGecko",
        "parameters_schema": GetTrendingCoinsParameters
    })
    async def get_trending_coins(self, parameters: dict):
        """Get the list of trending coins from CoinGecko"""
        async with aiohttp.ClientSession() as session:
            url = f"{self.base_url}/search/trending?x_cg_demo_api_key={self.api_key}"
            async with session.get(url) as response:
                if not response.ok:
                    raise Exception(f"HTTP error! status: {response.status} {await response.text()}")
                return await response.json()

    @Tool({
        "description": "Get the price of a specific coin from CoinGecko",
        "parameters_schema": GetCoinPriceParameters
    })
    async def get_coin_price(self, parameters: dict):
        """Get the price of a specific coin from CoinGecko"""
        params = {
            "ids": parameters["coin_id"],
            "vs_currencies": parameters["vs_currency"],
            "include_market_cap": str(parameters["include_market_cap"]).lower(),
            "include_24hr_vol": str(parameters["include_24hr_vol"]).lower(),
            "include_24hr_change": str(parameters["include_24hr_change"]).lower(),
            "include_last_updated_at": str(parameters["include_last_updated_at"]).lower(),
            "x_cg_demo_api_key": self.api_key
        }
        
        async with aiohttp.ClientSession() as session:
            url = f"{self.base_url}/simple/price"
            async with session.get(url, params=params) as response:
                if not response.ok:
                    raise Exception(f"HTTP error! status: {response.status} {await response.text()}")
                return await response.json()

    @Tool({
        "description": "Search for coins on CoinGecko",
        "parameters_schema": SearchCoinsParameters
    })
    async def search_coins(self, parameters: dict):
        """Search for coins on CoinGecko"""
        params = {
            "query": parameters["query"],
            "x_cg_demo_api_key": self.api_key
        }
        
        async with aiohttp.ClientSession() as session:
            url = f"{self.base_url}/search"
            async with session.get(url, params=params) as response:
                if not response.ok:
                    raise Exception(f"HTTP error! status: {response.status} {await response.text()}")
                data = await response.json()
                
                if parameters["exact_match"]:
                    coins = data.get("coins", [])
                    exact_matches = [
                        coin for coin in coins 
                        if coin.get("id") == parameters["query"] or 
                           coin.get("symbol").lower() == parameters["query"].lower() or
                           coin.get("name").lower() == parameters["query"].lower()
                    ]
                    data["coins"] = exact_matches
                
                return data
