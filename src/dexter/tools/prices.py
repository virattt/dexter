from langchain.tools import tool
from typing import Literal, Optional
from pydantic import BaseModel, Field
from dexter.tools.api import call_api, resolve_crypto_identifier
from datetime import datetime

####################################
# Tools
####################################

class PriceSnapshotInput(BaseModel):
    """Input for get_price_snapshot."""
    identifier: str = Field(
        description="The cryptocurrency identifier. Can be either a CoinGecko ID (e.g., 'bitcoin', 'ethereum') or ticker symbol (e.g., 'BTC', 'ETH')."
    )
    vs_currency: str = Field(
        default="usd",
        description="The target currency for price data. Defaults to 'usd'. Other options: 'eur', 'gbp', 'jpy', etc."
    )

@tool(args_schema=PriceSnapshotInput)
def get_price_snapshot(identifier: str, vs_currency: str = "usd") -> dict:
    """
    Fetches the current price snapshot for a cryptocurrency,
    including current price, market cap, 24h volume, price changes, and other key metrics.
    
    Use this to get the most recent market data for a specific cryptocurrency.
    """
    coin_id = resolve_crypto_identifier(identifier)
    
    data = call_api(
        f"/coins/{coin_id}",
        params={
            "localization": "false",
            "tickers": "false",
            "community_data": "true",
            "developer_data": "false",
            "sparkline": "false"
        }
    )
    
    # Extract relevant market data
    market_data = data.get("market_data", {})
    
    snapshot = {
        "id": data.get("id"),
        "symbol": data.get("symbol", "").upper(),
        "name": data.get("name"),
        "current_price": market_data.get("current_price", {}).get(vs_currency),
        "market_cap": market_data.get("market_cap", {}).get(vs_currency),
        "market_cap_rank": market_data.get("market_cap_rank"),
        "total_volume": market_data.get("total_volume", {}).get(vs_currency),
        "high_24h": market_data.get("high_24h", {}).get(vs_currency),
        "low_24h": market_data.get("low_24h", {}).get(vs_currency),
        "price_change_24h": market_data.get("price_change_24h"),
        "price_change_percentage_24h": market_data.get("price_change_percentage_24h"),
        "price_change_percentage_7d": market_data.get("price_change_percentage_7d"),
        "price_change_percentage_30d": market_data.get("price_change_percentage_30d"),
        "circulating_supply": market_data.get("circulating_supply"),
        "total_supply": market_data.get("total_supply"),
        "max_supply": market_data.get("max_supply"),
        "ath": market_data.get("ath", {}).get(vs_currency),
        "ath_date": market_data.get("ath_date", {}).get(vs_currency),
        "atl": market_data.get("atl", {}).get(vs_currency),
        "atl_date": market_data.get("atl_date", {}).get(vs_currency),
        "last_updated": market_data.get("last_updated"),
    }
    
    return snapshot


class HistoricalPricesInput(BaseModel):
    """Input for get_historical_prices."""
    identifier: str = Field(
        description="The cryptocurrency identifier. Can be either a CoinGecko ID (e.g., 'bitcoin', 'ethereum') or ticker symbol (e.g., 'BTC', 'ETH')."
    )
    vs_currency: str = Field(
        default="usd",
        description="The target currency for price data. Defaults to 'usd'."
    )
    days: int = Field(
        default=30,
        description="Number of days of historical data to fetch. Use 1, 7, 14, 30, 90, 180, 365, or 'max'. Defaults to 30."
    )
    interval: Optional[str] = Field(
        default=None,
        description="Data interval. Options: 'daily' (default for >90 days), 'hourly' (for <=90 days). If not specified, API chooses automatically."
    )

@tool(args_schema=HistoricalPricesInput)
def get_historical_prices(
    identifier: str,
    vs_currency: str = "usd",
    days: int = 30,
    interval: Optional[str] = None
) -> dict:
    """
    Retrieves historical price data (market chart) for a cryptocurrency over a specified time period.
    
    Returns time series data including price, market cap, and volume.
    Useful for analyzing price trends, volatility, and market performance over time.
    """
    coin_id = resolve_crypto_identifier(identifier)
    
    params = {
        "vs_currency": vs_currency,
        "days": days
    }
    
    if interval:
        params["interval"] = interval
    
    data = call_api(f"/coins/{coin_id}/market_chart", params=params)
    
    # Format the data for better readability
    prices = data.get("prices", [])
    market_caps = data.get("market_caps", [])
    total_volumes = data.get("total_volumes", [])
    
    formatted_data = {
        "id": coin_id,
        "vs_currency": vs_currency,
        "days": days,
        "data_points": len(prices),
        "prices": [{"timestamp": p[0], "price": p[1]} for p in prices],
        "market_caps": [{"timestamp": m[0], "market_cap": m[1]} for m in market_caps],
        "total_volumes": [{"timestamp": v[0], "volume": v[1]} for v in total_volumes],
    }
    
    return formatted_data


class OHLCInput(BaseModel):
    """Input for get_ohlc_data."""
    identifier: str = Field(
        description="The cryptocurrency identifier. Can be either a CoinGecko ID (e.g., 'bitcoin', 'ethereum') or ticker symbol (e.g., 'BTC', 'ETH')."
    )
    vs_currency: str = Field(
        default="usd",
        description="The target currency for price data. Defaults to 'usd'."
    )
    days: Literal[1, 7, 14, 30, 90, 180, 365] = Field(
        default=7,
        description="Number of days of OHLC data. Valid values: 1, 7, 14, 30, 90, 180, 365. Defaults to 7."
    )

@tool(args_schema=OHLCInput)
def get_ohlc_data(
    identifier: str,
    vs_currency: str = "usd",
    days: Literal[1, 7, 14, 30, 90, 180, 365] = 7
) -> dict:
    """
    Retrieves OHLC (Open, High, Low, Close) candlestick data for a cryptocurrency.
    
    Returns candle data at regular intervals based on the time period:
    - 1 day: 30-minute intervals
    - 7-30 days: 4-hour intervals
    - 31+ days: 4-day intervals
    
    Useful for technical analysis and charting.
    """
    coin_id = resolve_crypto_identifier(identifier)
    
    params = {
        "vs_currency": vs_currency,
        "days": days
    }
    
    data = call_api(f"/coins/{coin_id}/ohlc", params=params)
    
    # Format OHLC data
    # Each entry is [timestamp, open, high, low, close]
    formatted_data = {
        "id": coin_id,
        "vs_currency": vs_currency,
        "days": days,
        "candles": [
            {
                "timestamp": candle[0],
                "open": candle[1],
                "high": candle[2],
                "low": candle[3],
                "close": candle[4]
            }
            for candle in data
        ]
    }
    
    return formatted_data
