#!/usr/bin/env python3
"""
Quick script to test which CoinGecko API endpoints are accessible with your API key.
Run this to diagnose which endpoints work with your Analyst plan.
"""

import os
import requests
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("COINGECKO_API_KEY")
BASE_URL = "https://pro-api.coingecko.com/api/v3"

def test_endpoint(endpoint, params=None, description=""):
    """Test if an endpoint is accessible"""
    url = f"{BASE_URL}{endpoint}"
    headers = {"x-cg-pro-api-key": API_KEY}
    
    print(f"\nTesting: {description or endpoint}")
    print(f"URL: {url}")
    if params:
        print(f"Params: {params}")
    
    try:
        response = requests.get(url, params=params, headers=headers)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            print("✓ SUCCESS - Endpoint is accessible")
            return True
        elif response.status_code == 401:
            print("✗ UNAUTHORIZED - Endpoint not available in your plan")
            return False
        elif response.status_code == 429:
            print("⚠ RATE LIMIT - Too many requests")
            return False
        else:
            print(f"⚠ ERROR - {response.status_code}: {response.text[:200]}")
            return False
    except Exception as e:
        print(f"✗ EXCEPTION: {e}")
        return False


print("=" * 60)
print("CoinGecko API Endpoint Access Test")
print("=" * 60)
print(f"API Key: {API_KEY[:10]}..." if API_KEY else "No API key found!")
print()

# Test different endpoints
results = {}

# 1. Simple price (should work)
results['simple_price'] = test_endpoint(
    "/simple/price",
    {"ids": "solana", "vs_currencies": "usd"},
    "Simple Price (current price only)"
)

# 2. Coin data (should work - this is what get_price_snapshot uses)
results['coin_data'] = test_endpoint(
    "/coins/solana",
    {"localization": "false", "tickers": "false"},
    "Coin Data (detailed coin info)"
)

# 3. Market chart (historical - THIS IS FAILING)
results['market_chart'] = test_endpoint(
    "/coins/solana/market_chart",
    {"vs_currency": "usd", "days": "30"},
    "Market Chart (30-day historical)"
)

# 4. Market chart range (alternative)
results['market_chart_range'] = test_endpoint(
    "/coins/solana/market_chart/range",
    {"vs_currency": "usd", "from": "1609459200", "to": "1612137600"},
    "Market Chart Range (date range)"
)

# 5. OHLC data
results['ohlc'] = test_endpoint(
    "/coins/solana/ohlc",
    {"vs_currency": "usd", "days": "7"},
    "OHLC (candlestick data)"
)

# 6. Top cryptocurrencies
results['markets'] = test_endpoint(
    "/coins/markets",
    {"vs_currency": "usd", "per_page": "10"},
    "Markets (top cryptocurrencies)"
)

# Summary
print("\n" + "=" * 60)
print("SUMMARY")
print("=" * 60)
for endpoint, success in results.items():
    status = "✓ Available" if success else "✗ Not Available"
    print(f"{endpoint:25} {status}")

print("\n" + "=" * 60)
print("RECOMMENDATION")
print("=" * 60)

if not results.get('market_chart'):
    print("""
The /market_chart endpoint is NOT available in your Analyst plan.

Options to fix this:
1. UPGRADE your CoinGecko API plan to Developer or Enterprise tier
2. REMOVE historical price features from your agent
3. USE ALTERNATIVE data source for historical prices
4. CONTACT CoinGecko support to verify your plan's endpoint access

The good news: Current price data and coin info endpoints work fine!
""")
else:
    print("All endpoints are accessible!")

