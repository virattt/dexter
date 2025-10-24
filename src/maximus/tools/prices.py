from langchain.tools import tool
from typing import Literal, Optional
from pydantic import BaseModel, Field
from maximus.tools.api import call_api, resolve_crypto_identifier
from maximus.utils.charts import render_candlestick_chart, render_line_chart
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
    show_chart: bool = Field(
        default=False,
        description="Set to True ONLY if user explicitly asks to 'show', 'display', 'visualize', or 'chart' the data. For visualization requests, prefer using visualize_crypto_chart() tool instead."
    )

@tool(args_schema=HistoricalPricesInput)
def get_historical_prices(
    identifier: str,
    vs_currency: str = "usd",
    days: int = 30,
    interval: Optional[str] = None,
    show_chart: bool = False
) -> dict:
    """
    Retrieves historical price data (market chart) for a cryptocurrency over a specified time period.
    Returns structured time series data for analysis.
    
    Note: For visualization, use visualize_crypto_chart() tool instead of show_chart parameter.
    
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
    
    # Display chart if requested
    if show_chart and formatted_data["prices"]:
        try:
            title = f"{coin_id.upper()} Price - {days} Day History"
            render_line_chart(formatted_data["prices"], title=title, vs_currency=vs_currency)
        except Exception as e:
            # Don't fail the entire tool if chart rendering fails
            print(f"Note: Chart display failed: {e}")
    
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
    days: Literal['1', '7', '14', '30', '90', '180', '365', 'max'] = Field(
        default='7',
        description="Number of days of OHLC data. Valid values: '1', '7', '14', '30', '90', '180', '365', 'max'. Defaults to '7'."
    )
    interval: Optional[Literal['daily', 'hourly']] = Field(
        default=None,
        description="Data interval. Options: 'daily' or 'hourly'. If not specified, API chooses automatically based on time range."
    )
    precision: Optional[Literal['full', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18']] = Field(
        default=None,
        description="Decimal place for currency price value. Options: 'full' or '0' through '18'. If not specified, uses API default precision."
    )
    show_chart: bool = Field(
        default=False,
        description="Set to True ONLY if user explicitly asks to 'show', 'display', 'visualize', or 'chart' the data. For visualization requests, prefer using visualize_crypto_chart() tool instead."
    )

@tool(args_schema=OHLCInput)
def get_ohlc_data(
    identifier: str,
    vs_currency: str = "usd",
    days: Literal['1', '7', '14', '30', '90', '180', '365', 'max'] = '7',
    interval: Optional[Literal['daily', 'hourly']] = None,
    precision: Optional[Literal['full', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18']] = None,
    show_chart: bool = False
) -> dict:
    """
    Retrieves OHLC (Open, High, Low, Close) candlestick data for a cryptocurrency.
    Returns structured data for analysis.
    
    Note: For visualization, use visualize_crypto_chart() tool instead of show_chart parameter.
    
    Returns candle data at regular intervals based on the time period:
    - 1 day: 30-minute intervals
    - 7-30 days: 4-hour intervals
    - 31+ days: 4-day intervals
    
    Parameters:
    - identifier: Cryptocurrency ID or symbol
    - vs_currency: Target currency (default: 'usd')
    - days: Data range - '1', '7', '14', '30', '90', '180', '365', or 'max' (default: '7')
    - interval: Optional interval - 'daily' or 'hourly' (auto if not specified)
    - precision: Optional decimal precision - 'full' or '0' through '18' (API default if not specified)
    - show_chart: Display candlestick chart in terminal (default: True)
    
    Useful for technical analysis and charting.
    """
    coin_id = resolve_crypto_identifier(identifier)
    
    params = {
        "vs_currency": vs_currency,
        "days": days
    }
    
    # Add optional parameters if provided
    if interval:
        params["interval"] = interval
    if precision:
        params["precision"] = precision
    
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
    
    # Display chart if requested
    if show_chart and formatted_data["candles"]:
        try:
            render_candlestick_chart(formatted_data)
        except Exception as e:
            # Don't fail the entire tool if chart rendering fails
            print(f"Note: Chart display failed: {e}")
    
    return formatted_data


class VisualizeCryptoChartInput(BaseModel):
    """Input for visualize_crypto_chart."""
    identifier: str = Field(
        description="The cryptocurrency identifier. Can be either a CoinGecko ID (e.g., 'bitcoin', 'ethereum') or ticker symbol (e.g., 'BTC', 'ETH')."
    )
    chart_type: Literal['line', 'candlestick'] = Field(
        default='line',
        description="Type of chart to display: 'line' for price trend (default), 'candlestick' for OHLC data."
    )
    days: Literal['1', '7', '14', '30', '90', '180', '365', 'max'] = Field(
        default='7',
        description="Number of days of data to visualize. Valid values: '1', '7', '14', '30', '90', '180', '365', 'max'. Defaults to '7'."
    )
    vs_currency: str = Field(
        default="usd",
        description="The target currency for price data. Defaults to 'usd'."
    )

@tool(args_schema=VisualizeCryptoChartInput)
def visualize_crypto_chart(
    identifier: str,
    chart_type: Literal['line', 'candlestick'] = 'line',
    days: Literal['1', '7', '14', '30', '90', '180', '365', 'max'] = '7',
    vs_currency: str = "usd"
) -> str:
    """
    PRIMARY VISUALIZATION TOOL: Displays cryptocurrency price charts in the terminal.
    
    *** USE THIS TOOL when users ask to "show", "display", "visualize", "chart", or "see" price data ***
    
    This tool fetches data and renders clean ASCII line charts directly in the terminal.
    Users will see the visual representation immediately.
    
    Chart types:
    - 'line': Simple price trend line chart (DEFAULT - best for most uses)
    - 'candlestick': OHLC candlestick chart (only if user specifically asks for OHLC/candlestick)
    
    When to use:
    - User wants to SEE, SHOW, VISUALIZE, or CHART price movements
    - User asks about price trends, charts, or historical data
    - User requests visual representation of data
    
    Examples of queries that need this tool:
    - "show me the chart for Bitcoin"
    - "visualize Ethereum price over 30 days"
    - "display Solana's price movements"
    - "I want to see the 7-day chart"
    
    Use 'line' chart type unless user specifically mentions "OHLC" or "candlestick".
    """
    try:
        coin_id = resolve_crypto_identifier(identifier)
        
        # Print header BEFORE chart to ensure it appears first
        # print(f"\n{'='*80}")
        # print(f"Rendering {chart_type} chart for {coin_id.upper()} ({days} days)...")
        # print(f"{'='*80}\n")
        import sys
        sys.stdout.flush()
        
        if chart_type == 'line':
            # Fetch and display line chart (note: this endpoint may require API upgrade)
            # For now, use OHLC data and plot close prices as a line
            ohlc_data = get_ohlc_data.invoke({
                "identifier": identifier,
                "vs_currency": vs_currency,
                "days": days,
                "show_chart": False  # We'll render manually
            })
            
            # Extract close prices for line chart
            from maximus.utils.charts import render_line_chart
            price_data = [
                {"timestamp": candle["timestamp"], "price": candle["close"]}
                for candle in ohlc_data["candles"]
            ]
            
            title = f"{coin_id.upper()} Price - {days} Day Chart"
            render_line_chart(price_data, title=title, vs_currency=vs_currency)
            
        elif chart_type == 'candlestick':
            # Fetch and display OHLC candlestick chart
            ohlc_data = get_ohlc_data.invoke({
                "identifier": identifier,
                "vs_currency": vs_currency,
                "days": days,
                "show_chart": True
            })
        
        return f"Successfully displayed {chart_type} chart for {coin_id.upper()} ({days} days)"
    
    except Exception as e:
        return f"Failed to display chart: {str(e)}"
