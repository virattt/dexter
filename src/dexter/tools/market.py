from langchain.tools import tool
from typing import Optional
from pydantic import BaseModel, Field
from dexter.tools.api import call_api

####################################
# Tools
####################################

class TopCryptocurrenciesInput(BaseModel):
    """Input for get_top_cryptocurrencies."""
    vs_currency: str = Field(
        default="usd",
        description="The target currency for price data. Defaults to 'usd'."
    )
    limit: int = Field(
        default=100,
        description="Number of cryptocurrencies to return. Defaults to 100, max 250."
    )
    order: str = Field(
        default="market_cap_desc",
        description="Sort order. Options: 'market_cap_desc', 'volume_desc', 'id_asc', 'id_desc'. Defaults to 'market_cap_desc'."
    )
    category: Optional[str] = Field(
        default=None,
        description="Filter by category (e.g., 'decentralized-finance-defi', 'stablecoins', 'layer-1'). If not specified, returns all categories."
    )

@tool(args_schema=TopCryptocurrenciesInput)
def get_top_cryptocurrencies(
    vs_currency: str = "usd",
    limit: int = 100,
    order: str = "market_cap_desc",
    category: Optional[str] = None
) -> list[dict]:
    """
    Retrieves a list of top cryptocurrencies ranked by market capitalization or other metrics.
    
    Returns current market data for multiple cryptocurrencies including:
    - Current price, market cap, volume
    - Price changes over 24h, 7d, 30d
    - Market cap rank
    
    Useful for comparing multiple cryptocurrencies and identifying market leaders.
    """
    params = {
        "vs_currency": vs_currency,
        "order": order,
        "per_page": min(limit, 250),  # API max is 250
        "page": 1,
        "sparkline": "false",
        "price_change_percentage": "24h,7d,30d"
    }
    
    if category:
        params["category"] = category
    
    data = call_api("/coins/markets", params=params)
    
    # Format the response
    formatted_data = []
    for coin in data:
        formatted_data.append({
            "id": coin.get("id"),
            "symbol": coin.get("symbol", "").upper(),
            "name": coin.get("name"),
            "current_price": coin.get("current_price"),
            "market_cap": coin.get("market_cap"),
            "market_cap_rank": coin.get("market_cap_rank"),
            "total_volume": coin.get("total_volume"),
            "high_24h": coin.get("high_24h"),
            "low_24h": coin.get("low_24h"),
            "price_change_24h": coin.get("price_change_24h"),
            "price_change_percentage_24h": coin.get("price_change_percentage_24h"),
            "price_change_percentage_7d": coin.get("price_change_percentage_7d_in_currency"),
            "price_change_percentage_30d": coin.get("price_change_percentage_30d_in_currency"),
            "circulating_supply": coin.get("circulating_supply"),
            "total_supply": coin.get("total_supply"),
            "max_supply": coin.get("max_supply"),
            "ath": coin.get("ath"),
            "atl": coin.get("atl"),
            "last_updated": coin.get("last_updated"),
        })
    
    return formatted_data


class GlobalMarketDataInput(BaseModel):
    """Input for get_global_market_data."""
    pass

@tool(args_schema=GlobalMarketDataInput)
def get_global_market_data() -> dict:
    """
    Retrieves global cryptocurrency market statistics and metrics.
    
    Returns aggregated data including:
    - Total market capitalization across all cryptocurrencies
    - Total 24h trading volume
    - Bitcoin and Ethereum dominance percentages
    - Number of active cryptocurrencies and markets
    - Market cap change percentages
    
    Useful for understanding overall market sentiment and trends.
    """
    data = call_api("/global")
    
    global_data = data.get("data", {})
    
    formatted_data = {
        "active_cryptocurrencies": global_data.get("active_cryptocurrencies"),
        "markets": global_data.get("markets"),
        "total_market_cap": global_data.get("total_market_cap", {}).get("usd"),
        "total_volume_24h": global_data.get("total_volume", {}).get("usd"),
        "market_cap_percentage": {
            "btc": global_data.get("market_cap_percentage", {}).get("btc"),
            "eth": global_data.get("market_cap_percentage", {}).get("eth"),
        },
        "market_cap_change_percentage_24h": global_data.get("market_cap_change_percentage_24h_usd"),
        "updated_at": global_data.get("updated_at"),
    }
    
    return formatted_data


class TrendingCoinsInput(BaseModel):
    """Input for get_trending_coins."""
    pass

@tool(args_schema=TrendingCoinsInput)
def get_trending_coins() -> list[dict]:
    """
    Retrieves currently trending cryptocurrencies based on search activity on CoinGecko.
    
    Returns the top trending coins in the last 24 hours, including:
    - Coin name, symbol, and market cap rank
    - Price in BTC and USD
    - Recent price changes
    
    Useful for identifying coins with increased market attention and interest.
    """
    data = call_api("/search/trending")
    
    coins = data.get("coins", [])
    
    formatted_data = []
    for item in coins:
        coin = item.get("item", {})
        formatted_data.append({
            "id": coin.get("id"),
            "coin_id": coin.get("coin_id"),
            "name": coin.get("name"),
            "symbol": coin.get("symbol"),
            "market_cap_rank": coin.get("market_cap_rank"),
            "thumb": coin.get("thumb"),
            "price_btc": coin.get("price_btc"),
            "score": coin.get("score"),
        })
    
    return formatted_data

