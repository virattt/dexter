#!/usr/bin/env python3
"""
Test script for terminal chart visualization - Simple line charts.
Run this after installing dependencies with: uv sync
"""

from dotenv import load_dotenv
load_dotenv()

from maximus.tools.prices import visualize_crypto_chart

print("=" * 80)
print("Terminal Charts Test - Line Chart Visualization")
print("=" * 80)

# Test 1: Line chart for Bitcoin (7 days - default)
print("\n1. Testing line chart (7-day Bitcoin)")
print("-" * 80)
try:
    result = visualize_crypto_chart.invoke({
        "identifier": "bitcoin",
        "chart_type": "line",
        "days": "7",
        "vs_currency": "usd"
    })
    print(f"✓ {result}")
except Exception as e:
    print(f"✗ Error: {e}")

# Test 2: Line chart for Solana (14 days)
print("\n2. Testing line chart (14-day Solana)")
print("-" * 80)
try:
    result = visualize_crypto_chart.invoke({
        "identifier": "solana",
        "chart_type": "line",
        "days": "14",
        "vs_currency": "usd"
    })
    print(f"✓ {result}")
except Exception as e:
    print(f"✗ Error: {e}")

# Test 3: Line chart for Ethereum (30 days)
print("\n3. Testing line chart (30-day Ethereum)")
print("-" * 80)
try:
    result = visualize_crypto_chart.invoke({
        "identifier": "ethereum",
        "chart_type": "line",
        "days": "30",
        "vs_currency": "usd"
    })
    print(f"✓ {result}")
except Exception as e:
    print(f"✗ Error: {e}")

# Test 4: Default (line chart without specifying type)
print("\n4. Testing default visualization (Cardano, 7 days)")
print("-" * 80)
try:
    result = visualize_crypto_chart.invoke({
        "identifier": "ada",
        "days": "7",
        "vs_currency": "usd"
    })
    print(f"✓ {result}")
except Exception as e:
    print(f"✗ Error: {e}")

print("\n" + "=" * 80)
print("All tests completed!")
print("=" * 80)
print("\nNote: Charts should appear above each test section.")
print("If charts don't display, ensure 'plotext' is installed: uv sync")

