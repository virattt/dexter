#!/usr/bin/env python3
"""
Dark Dexter - AI Agent Startup Script

Features:
- Creates/loads Dexter's Solana wallet
- Displays trending Solana tokens
- Shows wallet balance using multiple data sources
"""

import os
import json
from pathlib import Path
from dotenv import load_dotenv
from solders.keypair import Keypair
from solana.rpc.api import Client as SolanaClient

from src.dexter.tools.birdeye.client import BirdEyeClient
from src.dexter.tools.helius.client import HeliusClient

# Load environment variables
load_dotenv()

# ASCII Art
DARK_DEXTER_ASCII = """
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                           ║
║   ██████╗  █████╗ ██████╗ ██╗  ██╗    ██████╗ ███████╗██╗  ██╗████████╗ ║
║   ██╔══██╗██╔══██╗██╔══██╗██║ ██╔╝    ██╔══██╗██╔════╝╚██╗██╔╝╚══██╔══╝ ║
║   ██║  ██║███████║██████╔╝█████╔╝     ██║  ██║█████╗   ╚███╔╝    ██║    ║
║   ██║  ██║██╔══██║██╔══██╗██╔═██╗     ██║  ██║██╔══╝   ██╔██╗    ██║    ║
║   ██████╔╝██║  ██║██║  ██║██║  ██╗    ██████╔╝███████╗██╔╝ ██╗   ██║    ║
║   ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝    ╚═════╝ ╚══════╝╚═╝  ╚═╝   ╚═╝    ║
║                                                                           ║
║                🌑 Autonomous Financial Intelligence Agent 🌑              ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
"""

WALLET_FILE = Path.home() / ".dexter" / "wallet.json"


def create_or_load_wallet() -> Keypair:
    """Create or load Dexter's Solana wallet."""
    
    # Ensure .dexter directory exists
    WALLET_FILE.parent.mkdir(parents=True, exist_ok=True)
    
    if WALLET_FILE.exists():
        print("🔓 Loading existing Dark Dexter wallet...")
        with open(WALLET_FILE, 'r') as f:
            wallet_data = json.load(f)
            keypair = Keypair.from_bytes(bytes(wallet_data['secret_key']))
        print(f"✅ Wallet loaded: {keypair.pubkey()}\n")
    else:
        print("🔑 Creating new Dark Dexter wallet...")
        keypair = Keypair()
        
        # Save wallet to file
        wallet_data = {
            'public_key': str(keypair.pubkey()),
            'secret_key': list(bytes(keypair))
        }
        
        with open(WALLET_FILE, 'w') as f:
            json.dump(wallet_data, f)
        
        print(f"✅ New wallet created: {keypair.pubkey()}")
        print(f"📁 Wallet saved to: {WALLET_FILE}\n")
    
    return keypair


def display_trending_tokens():
    """Display trending Solana tokens using BirdEye API."""
    try:
        print("📈 TRENDING SOLANA TOKENS")
        print("=" * 80)
        
        birdeye = BirdEyeClient()
        trending = birdeye.get_trending_tokens(limit=10)
        
        print(f"{'Rank':<6} {'Symbol':<12} {'Name':<25} {'Price':<15} {'24h':<10}")
        print("-" * 80)
        
        for token in trending:
            rank = f"#{token.rank}" if token.rank else "N/A"
            symbol = token.symbol[:10] if token.symbol else "N/A"
            name = token.name[:23] if token.name else "N/A"
            price = f"${token.price:.8f}" if token.price else "N/A"
            change_24h = f"{token.price_change_24h_percent:+.2f}%" if token.price_change_24h_percent else "N/A"
            
            # Color code the 24h change
            if token.price_change_24h_percent:
                if token.price_change_24h_percent > 0:
                    change_24h = f"🟢 {change_24h}"
                else:
                    change_24h = f"🔴 {change_24h}"
            
            print(f"{rank:<6} {symbol:<12} {name:<25} {price:<15} {change_24h:<10}")
        
        print("=" * 80)
        print()
        
    except Exception as e:
        print(f"⚠️  Error fetching trending tokens: {e}\n")


def display_wallet_balance(wallet_address: str):
    """Display wallet balance using BirdEye and Helius APIs."""
    print("💰 WALLET BALANCE")
    print("=" * 80)
    print(f"📍 Address: {wallet_address}\n")
    
    # Try BirdEye first
    try:
        print("🐦 BirdEye Data:")
        birdeye = BirdEyeClient()
        portfolio = birdeye.get_wallet_portfolio(wallet_address)
        
        print(f"   Total Portfolio Value: ${portfolio.total_usd:.2f} USD")
        
        if portfolio.items:
            print(f"   Token Count: {len(portfolio.items)}")
            print(f"\n   {'Symbol':<12} {'Balance':<20} {'Value':<15}")
            print(f"   {'-' * 47}")
            
            for item in portfolio.items[:5]:  # Show top 5 tokens
                symbol = item.get('symbol', 'Unknown')[:10]
                ui_amount = item.get('uiAmount', 0)
                value_usd = item.get('valueUSD', 0)
                print(f"   {symbol:<12} {ui_amount:<20.4f} ${value_usd:<14.2f}")
            
            if len(portfolio.items) > 5:
                print(f"   ... and {len(portfolio.items) - 5} more tokens")
        else:
            print("   No tokens found in wallet")
        
        print()
        
    except Exception as e:
        print(f"   ⚠️  Error fetching BirdEye data: {e}\n")
    
    # Try Helius
    try:
        print("🌟 Helius Data:")
        helius = HeliusClient()
        rpc_url = os.getenv("HELIUS_RPC_URL", "https://api.devnet.helius.xyz/v1/" + os.getenv("HELIUS_API_KEY", ""))
        client = SolanaClient(rpc_url)
        
        # Get SOL balance
        balance_response = client.get_balance(wallet_address)
        if balance_response.value:
            sol_balance = balance_response.value / 1e9  # Convert lamports to SOL
            print(f"   SOL Balance: {sol_balance:.4f} SOL")
        
        # Get assets owned by wallet
        assets = helius.get_assets_by_owner(wallet_address, limit=5)
        if assets:
            print(f"   NFT/Asset Count: {len(assets)}")
            asset_list = list(assets)[:3]
            for i, asset in enumerate(asset_list, 1):
                try:
                    name = asset.content.metadata.get('name', 'Unknown') if asset.content and asset.content.metadata else 'Unknown'
                except Exception:
                    name = 'Unknown'
                print(f"   {i}. {name}")
        
        print()
        
    except Exception as e:
        print(f"   ⚠️  Error fetching Helius data: {e}\n")
    
    print("=" * 80)
    print()


def analyze_token_price(token_address: str = None):
    """Perform comprehensive realtime price analysis on a Solana token."""
    
    if not token_address:
        token_address = input("Enter token address to analyze: ").strip()
    
    if not token_address:
        print("❌ No token address provided\n")
        return
    
    try:
        print(f"\n🔍 REALTIME PRICE ANALYSIS")
        print("=" * 80)
        print(f"Token: {token_address}")
        print(f"Time: Now\n")
        
        birdeye = BirdEyeClient()
        
        # Get comprehensive analysis
        print("⏳ Fetching token data...")
        
        # Get price stats
        try:
            stats = birdeye.get_price_stats(token_address)
            
            print(f"\n💰 Current Price: ${stats.price:.8f}")
            
            print(f"\n📊 Price Changes:")
            if stats.price_change_1m is not None:
                emoji = "🟢" if stats.price_change_1m >= 0 else "🔴"
                print(f"   1 minute:   {emoji} {stats.price_change_1m:+.2f}%")
            if stats.price_change_5m is not None:
                emoji = "🟢" if stats.price_change_5m >= 0 else "🔴"
                print(f"   5 minutes:  {emoji} {stats.price_change_5m:+.2f}%")
            if stats.price_change_1h is not None:
                emoji = "🟢" if stats.price_change_1h >= 0 else "🔴"
                print(f"   1 hour:     {emoji} {stats.price_change_1h:+.2f}%")
            if stats.price_change_24h is not None:
                emoji = "🟢" if stats.price_change_24h >= 0 else "🔴"
                print(f"   24 hours:   {emoji} {stats.price_change_24h:+.2f}%")
            
            if stats.liquidity or stats.volume_24h:
                print(f"\n📈 Market Data:")
                if stats.liquidity:
                    print(f"   Liquidity: ${stats.liquidity:,.2f}")
                if stats.volume_24h:
                    print(f"   Volume 24h: ${stats.volume_24h:,.2f}")
                if stats.market_cap:
                    print(f"   Market Cap: ${stats.market_cap:,.2f}")
            
        except Exception as e:
            print(f"⚠️  Price stats unavailable: {e}")
        
        # Get token overview
        try:
            overview = birdeye.get_token_overview(token_address)
            print(f"\n🪙 Token Info:")
            print(f"   Name: {overview.name}")
            print(f"   Symbol: {overview.symbol}")
            print(f"   Decimals: {overview.decimals}")
            
            if overview.holder:
                print(f"   Holders: {overview.holder:,}")
        except Exception as e:
            print(f"⚠️  Token overview unavailable: {e}")
        
        # Get recent trades
        try:
            trades = birdeye.get_token_trades(token_address, limit=5)
            if trades:
                print(f"\n💱 Recent Trades:")
                for i, trade in enumerate(trades[:5], 1):
                    emoji = "🟢" if trade.side == 'buy' else "🔴"
                    print(f"   {i}. {emoji} {trade.side.upper():4s} - ${trade.price:.8f} - ${trade.volume_usd:,.2f}")
        except Exception as e:
            print(f"⚠️  Recent trades unavailable: {e}")
        
        print("\n" + "=" * 80)
        print("✅ Analysis complete!\n")
        
    except Exception as e:
        print(f"❌ Error analyzing token: {e}\n")


def display_quick_actions():
    """Display available quick actions."""
    print("⚡ QUICK ACTIONS")
    print("=" * 80)
    print("1. 📊 View full wallet portfolio")
    print("2. 💱 Swap tokens (Jupiter)")
    print("3. 🎨 Mint NFT")
    print("4. 📤 Send SOL/tokens")
    print("5. 🔄 Refresh trending tokens")
    print("6. 💹 Analyze token price")
    print("7. 🚪 Exit")
    print("=" * 80)
    print()


def main():
    """Main entry point for Dark Dexter startup."""
    
    print(DARK_DEXTER_ASCII)
    print("🚀 Initializing Dark Dexter Agent...\n")
    
    # Create or load wallet
    wallet = create_or_load_wallet()
    wallet_address = str(wallet.pubkey())
    
    # Display trending tokens
    display_trending_tokens()
    
    # Display wallet balance
    display_wallet_balance(wallet_address)
    
    # Display quick actions
    display_quick_actions()
    
    print("✨ Dark Dexter is ready to assist with your financial operations!")
    print("   Use the actions above or run 'dexter-agent' for full interactive mode.\n")
    
    # Save wallet address to env for easy access
    print(f"💡 Tip: Your wallet address is stored at {WALLET_FILE}")
    print(f"    Public Key: {wallet_address}\n")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n👋 Dark Dexter signing off...\n")
    except Exception as e:
        print(f"\n❌ Error: {e}\n")
