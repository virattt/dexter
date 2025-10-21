from langchain.tools import tool
from typing import Literal, Optional
from pydantic import BaseModel, Field
from dexter.tools.api import call_api

class PriceSnapshotInput(BaseModel):
    """Input for get_price_snapshot."""
    ticker: str = Field(..., description="The stock ticker symbol to fetch the price snapshot for. For example, 'AAPL' for Apple.")

@tool(args_schema=PriceSnapshotInput)
def get_price_snapshot(ticker: str) -> dict:
    """
    Fetches the most recent price snapshot for a specific stock,
    including the latest price, trading volume, and other open, high, low, and close price data.
    """
    params = {"ticker": ticker}
    data = call_api("/prices/snapshot/", params)
    return data.get("snapshot", {})

class PricesInput(BaseModel):
    """Input for get_prices."""
    ticker: str = Field(..., description="The stock ticker symbol to fetch aggregated prices for. For example, 'AAPL' for Apple.")
    interval: Literal["minute", "day", "week", "month", "year"] = Field(default="day", description="The time interval for price data. Defaults to 'day'.")
    interval_multiplier: int = Field(default=1, description="Multiplier for the interval. Defaults to 1.")
    start_date: str = Field(..., description="Start date in YYYY-MM-DD format. Required.")
    end_date: str = Field(..., description="End date in YYYY-MM-DD format. Required.")

@tool(args_schema=PricesInput)
def get_prices(
    ticker: str,
    interval: Literal["minute", "day", "week", "month", "year"],
    interval_multiplier: int,
    start_date: str,
    end_date: str,
) -> dict:
    """
    Retrieves historical price data for a stock over a specified date range,
    including open, high, low, close prices, and volume.
    """
    params = {
        "ticker": ticker,
        "interval": interval,
        "interval_multiplier": interval_multiplier,
        "start_date": start_date,
        "end_date": end_date,
    }
    
    data = call_api("/prices/", params)
    return data.get("prices", [])
