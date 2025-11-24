"""
BirdEye Price Analysis Example
Demonstrates realtime price analysis for Solana SPL tokens.
"""

import os
import sys
import json
from datetime import datetime, timedelta

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from dotenv import load_dotenv
from src.dexter.tools.birdeye.client import BirdEyeClient

# Load environment variables
load_dotenv()

# Target token for analysis
TOKEN_ADDRESS = "4vB2PTyXauavhfrPUSuxPtrbXHjnsAGmk7DYoMkbpump"


def print_section(title: str):
    """Print a formatted section header."""
    print(f"\n{'=' * 80}")
    print(f"  {title}")
    print(f"{'=' * 80}\n")


def format_price(price: float) -> str:
    """Format price for display."""
    if price >= 1:
        return f"${price:.4f}"
    else:
        return f"${price:.8f}"


def format_percentage(pct: float | None) -> str:
    """Format percentage with color indicator."""
    if pct is None:
        return "N/A"
    sign = "+" if pct >= 0 else ""
    return f"{sign}{pct:.2f}%"


def format_number(num: float | None) -> str:
    """Format large numbers with abbreviations."""
    if num is None:
        return "N/A"
    
    if num >= 1_000_000_000:
        return f"${num / 1_000_000_000:.2f}B"
    elif num >= 1_000_000:
        return f"${num / 1_000_000:.2f}M"
    elif num >= 1_000:
        return f"${num / 1_000:.2f}K"
    else:
        return f"${num:.2f}"


def main():
    """Run comprehensive price analysis."""
    
    # Initialize BirdEye client
    client = BirdEyeClient()
    
    print_section(f"DARK DEXTER - REALTIME PRICE ANALYSIS")
    print(f"Token Address: {TOKEN_ADDRESS}")
    print(f"Analysis Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    # 1. Comprehensive Token Analysis
    print_section("1. COMPREHENSIVE TOKEN ANALYSIS")
    try:
        analysis = client.analyze_token_realtime(TOKEN_ADDRESS)
        
        # Token Info
        print("Token Information:")
        print(f"  Name: {analysis['token_info']['name']}")
        print(f"  Symbol: {analysis['token_info']['symbol']}")
        print(f"  Decimals: {analysis['token_info']['decimals']}")
        print(f"  Address: {analysis['token_info']['address']}")
        
        # Current Price
        print(f"\nCurrent Price: {format_price(analysis['price']['current'])}")
        
        # Price Changes
        print("\nPrice Changes:")
        changes = analysis['price']['changes']
        print(f"  1 minute:   {format_percentage(changes['1m'])}")
        print(f"  5 minutes:  {format_percentage(changes['5m'])}")
        print(f"  30 minutes: {format_percentage(changes['30m'])}")
        print(f"  1 hour:     {format_percentage(changes['1h'])}")
        print(f"  2 hours:    {format_percentage(changes['2h'])}")
        print(f"  4 hours:    {format_percentage(changes['4h'])}")
        print(f"  8 hours:    {format_percentage(changes['8h'])}")
        print(f"  24 hours:   {format_percentage(changes['24h'])}")
        
        # Market Data
        print("\nMarket Data:")
        market = analysis['market']
        print(f"  Liquidity:    {format_number(market['liquidity'])}")
        print(f"  Volume 24h:   {format_number(market['volume_24h'])}")
        print(f"  Volume Change: {format_percentage(market['volume_24h_change'])}")
        print(f"  Market Cap:   {format_number(market['market_cap'])}")
        print(f"  FDV:          {format_number(market['fdv'])}")
        print(f"  Holders:      {market['holders']:,}" if market['holders'] else "  Holders:      N/A")
        
        # Trading Activity
        print("\nTrading Activity (24h):")
        trading = analysis['trading']
        print(f"  Total Transactions: {trading['transactions_24h']:,}" if trading['transactions_24h'] else "  Total Transactions: N/A")
        print(f"  Buys:              {trading['buys_24h']:,}" if trading['buys_24h'] else "  Buys:              N/A")
        print(f"  Sells:             {trading['sells_24h']:,}" if trading['sells_24h'] else "  Sells:             N/A")
        print(f"  Buy Volume:        {format_number(trading['buy_volume_24h'])}")
        print(f"  Sell Volume:       {format_number(trading['sell_volume_24h'])}")
        if trading['buy_sell_ratio']:
            print(f"  Buy/Sell Ratio:    {trading['buy_sell_ratio']:.2f}")
        
        # Recent Trades
        print("\nRecent Trades (Top 5):")
        for i, trade in enumerate(analysis['recent_trades'], 1):
            side_emoji = "🟢" if trade['side'] == 'buy' else "🔴"
            print(f"  {i}. {side_emoji} {trade['side'].upper()} - {format_price(trade['price'])} - ${trade['volume_usd']:.2f}")
            print(f"     Time: {trade['time']}")
        
    except Exception as e:
        print(f"Error during comprehensive analysis: {e}")
    
    # 2. Price Statistics
    print_section("2. DETAILED PRICE STATISTICS")
    try:
        stats = client.get_price_stats(TOKEN_ADDRESS)
        
        print(f"Current Price: {format_price(stats.price)}")
        print(f"Liquidity: {format_number(stats.liquidity)}")
        print(f"Market Cap: {format_number(stats.market_cap)}")
        print(f"Volume 24h: {format_number(stats.volume_24h)}")
        print(f"Volume Change: {format_percentage(stats.volume_24h_change)}")
        print(f"\nLast Update: {stats.update_time}")
        
    except Exception as e:
        print(f"Error fetching price stats: {e}")
    
    # 3. OHLCV Data (Candlestick)
    print_section("3. OHLCV DATA (15-MINUTE CANDLES)")
    try:
        # Get last 10 candles
        ohlcv_data = client.get_ohlcv_data(TOKEN_ADDRESS, interval="15m")
        
        print("Recent 15-minute candles:")
        for i, candle in enumerate(ohlcv_data[:10], 1):
            print(f"\n  Candle {i} - {candle.datetime}")
            print(f"    Open:   {format_price(candle.open)}")
            print(f"    High:   {format_price(candle.high)}")
            print(f"    Low:    {format_price(candle.low)}")
            print(f"    Close:  {format_price(candle.close)}")
            print(f"    Volume: {candle.volume:,.2f}")
        
    except Exception as e:
        print(f"Error fetching OHLCV data: {e}")
    
    # 4. Historical Price
    print_section("4. HISTORICAL PRICE (LAST 24 HOURS)")
    try:
        # Get price from 24 hours ago to now
        now = int(datetime.now().timestamp())
        day_ago = int((datetime.now() - timedelta(days=1)).timestamp())
        
        historical = client.get_historical_price(TOKEN_ADDRESS, time_from=day_ago, time_to=now)
        
        if historical:
            print(f"Data points: {len(historical)}")
            print("\nSample prices:")
            # Show every 6th data point for readability
            for i in range(0, min(len(historical), 25), 6):
                price_point = historical[i]
                print(f"  {price_point.datetime}: {format_price(price_point.price)}")
        
    except Exception as e:
        print(f"Error fetching historical price: {e}")
    
    # 5. Recent Trades Detail
    print_section("5. RECENT TRADES (DETAILED)")
    try:
        trades = client.get_token_trades(TOKEN_ADDRESS, limit=20)
        
        print(f"Showing {len(trades)} recent trades:\n")
        
        for i, trade in enumerate(trades[:20], 1):
            side_emoji = "🟢" if trade.side == 'buy' else "🔴"
            time_str = datetime.fromtimestamp(trade.block_time).strftime('%H:%M:%S')
            
            print(f"{i:2d}. {side_emoji} {trade.side.upper():4s} | Price: {format_price(trade.price)} | "
                  f"Vol: ${trade.volume_usd:,.2f} | Time: {time_str}")
        
    except Exception as e:
        print(f"Error fetching trades: {e}")
    
    # 6. Market Data
    print_section("6. COMPREHENSIVE MARKET DATA")
    try:
        market_data = client.get_token_market_data(TOKEN_ADDRESS)
        
        print(f"Token: {market_data.symbol} ({market_data.name})")
        print(f"\nPrice: {format_price(market_data.price)}")
        print(f"Liquidity: {format_number(market_data.liquidity)}")
        print(f"Volume 24h: {format_number(market_data.volume_24h)}")
        print(f"Market Cap: {format_number(market_data.market_cap)}")
        print(f"FDV: {format_number(market_data.fdv)}")
        print(f"Holders: {market_data.holders:,}" if market_data.holders else "Holders: N/A")
        
        print(f"\n24h Activity:")
        print(f"  Total Transactions: {market_data.transactions_24h:,}" if market_data.transactions_24h else "  Total Transactions: N/A")
        print(f"  Buys:  {market_data.buys_24h:,}" if market_data.buys_24h else "  Buys:  N/A")
        print(f"  Sells: {market_data.sells_24h:,}" if market_data.sells_24h else "  Sells: N/A")
        
        print(f"\nPrice Changes:")
        print(f"  1h:  {format_percentage(market_data.price_change_1h)}")
        print(f"  24h: {format_percentage(market_data.price_change_24h)}")
        
    except Exception as e:
        print(f"Error fetching market data: {e}")
    
    # 7. Price/Volume Stats
    print_section("7. PRICE & VOLUME STATISTICS")
    try:
        pv_stats = client.get_price_volume_stats(TOKEN_ADDRESS)
        
        print(f"Current Price: {format_price(pv_stats.price)}")
        print(f"\nVolume:")
        print(f"  1 hour:  {format_number(pv_stats.volume_1h)}")
        print(f"  4 hours: {format_number(pv_stats.volume_4h)}")
        print(f"  24 hours: {format_number(pv_stats.volume_24h)}")
        
        print(f"\nVolume Changes:")
        print(f"  1h:  {format_percentage(pv_stats.volume_change_1h)}")
        print(f"  4h:  {format_percentage(pv_stats.volume_change_4h)}")
        print(f"  24h: {format_percentage(pv_stats.volume_change_24h)}")
        
        print(f"\n24h Price Range:")
        print(f"  High: {format_price(pv_stats.price_high_24h)}" if pv_stats.price_high_24h else "  High: N/A")
        print(f"  Low:  {format_price(pv_stats.price_low_24h)}" if pv_stats.price_low_24h else "  Low:  N/A")
        
    except Exception as e:
        print(f"Error fetching price/volume stats: {e}")
    
    print_section("ANALYSIS COMPLETE")
    print("Dark Dexter has successfully analyzed the token!")
    print(f"Token: {TOKEN_ADDRESS}\n")


if __name__ == "__main__":
    main()
