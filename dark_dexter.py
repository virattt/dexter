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
from solders.pubkey import Pubkey
from solana.rpc.api import Client as SolanaClient

from src.dexter.tools.birdeye.client import BirdEyeClient
from src.dexter.tools.helius.client import HeliusClient

# SAM 3 Vision imports (optional)
try:
    from src.dexter.tools.sam3 import Sam3Agent, Sam3ImageProcessor, segment_image
    HAS_SAM3 = True
except ImportError:
    HAS_SAM3 = False

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


def is_placeholder_value(value: str) -> bool:
    """Check if a value is a placeholder (not a real API key/URL)."""
    if not value:
        return True
    placeholders = ["your_", "your-", "placeholder", "xxx", "insert", "api_key_here"]
    value_lower = value.lower()
    return any(p in value_lower for p in placeholders)


def check_api_keys():
    """Check which API keys are configured."""
    keys = {
        "BIRDEYE_API_KEY": os.getenv("BIRDEYE_API_KEY"),
        "HELIUS_API_KEY": os.getenv("HELIUS_API_KEY"),
        "HELIUS_RPC_URL": os.getenv("HELIUS_RPC_URL"),
    }
    
    missing = [k for k, v in keys.items() if is_placeholder_value(v)]
    
    if missing:
        print("⚠️  API KEY STATUS:")
        print("-" * 40)
        for key in missing:
            print(f"   ❌ {key} - Not configured")
        configured = [k for k in keys.keys() if k not in missing]
        for key in configured:
            print(f"   ✅ {key} - Configured")
        print("-" * 40)
        print("   💡 Configure missing keys in your .env file")
        print()
    
    return missing


def display_trending_tokens():
    """Display trending Solana tokens using BirdEye API."""
    # Check if BirdEye API key is configured
    birdeye_key = os.getenv("BIRDEYE_API_KEY")
    if is_placeholder_value(birdeye_key):
        print("📈 TRENDING SOLANA TOKENS")
        print("=" * 80)
        print("   ⚠️  BirdEye API key not configured")
        print("   💡 Set BIRDEYE_API_KEY in your .env file to enable this feature")
        print("   🔗 Get your API key at: https://birdeye.so/")
        print("=" * 80)
        print()
        return
    
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
    
    # Try BirdEye first (if API key is configured)
    birdeye_key = os.getenv("BIRDEYE_API_KEY")
    if birdeye_key and not is_placeholder_value(birdeye_key):
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
    else:
        print("🐦 BirdEye Data:")
        print("   ⚠️  BirdEye API key not configured - skipping\n")
    
    # Try Helius (if API key is configured)
    helius_key = os.getenv("HELIUS_API_KEY")
    rpc_url = os.getenv("HELIUS_RPC_URL")
    
    if (helius_key and not is_placeholder_value(helius_key)) or (rpc_url and not is_placeholder_value(rpc_url)):
        try:
            print("🌟 Helius Data:")
            
            # Use RPC URL if available, otherwise construct from API key
            if rpc_url:
                client = SolanaClient(rpc_url)
            elif helius_key:
                client = SolanaClient(f"https://mainnet.helius-rpc.com/?api-key={helius_key}")
            else:
                raise ValueError("Neither HELIUS_RPC_URL nor HELIUS_API_KEY configured")
            
            # Get SOL balance - convert string to Pubkey
            wallet_pubkey = Pubkey.from_string(wallet_address)
            balance_response = client.get_balance(wallet_pubkey)
            if balance_response.value is not None:
                sol_balance = balance_response.value / 1e9  # Convert lamports to SOL
                print(f"   SOL Balance: {sol_balance:.4f} SOL")
            else:
                print("   SOL Balance: 0.0000 SOL (or unable to fetch)")
            
            # Only try DAS API if we have a proper API key
            if helius_key and not is_placeholder_value(helius_key):
                try:
                    helius = HeliusClient(api_key=helius_key)
                    assets_result = helius.get_assets_by_owner(wallet_address, limit=5)
                    items = assets_result.get("items", [])
                    if items:
                        print(f"   NFT/Asset Count: {len(items)}")
                        for i, asset in enumerate(items[:3], 1):
                            try:
                                name = asset.content.metadata.name if asset.content and asset.content.metadata else 'Unknown'
                            except Exception:
                                name = 'Unknown'
                            print(f"   {i}. {name}")
                except Exception as asset_err:
                    print(f"   (NFT data unavailable: {asset_err})")
            
            print()
            
        except Exception as e:
            print(f"   ⚠️  Error fetching Helius data: {e}\n")
    else:
        print("🌟 Helius Data:")
        print("   ⚠️  Helius API key/RPC URL not configured - skipping")
        print("   💡 Set HELIUS_API_KEY or HELIUS_RPC_URL in your .env file\n")
    
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


def analyze_image_with_sam3(image_path: str = None):
    """Analyze an image using SAM 3 vision capabilities."""
    if not HAS_SAM3:
        print("❌ SAM 3 Vision not available")
        print("   Install dependencies: pip install pillow numpy torch")
        print("   See docs/SAM3_INTEGRATION.md for setup instructions\n")
        return
    
    if not image_path:
        image_path = input("Enter image path or URL to analyze: ").strip()
    
    if not image_path:
        print("❌ No image provided\n")
        return
    
    try:
        print(f"\n👁️ SAM 3 VISION ANALYSIS")
        print("=" * 80)
        print(f"Image: {image_path}")
        print()
        
        # Initialize SAM 3 Agent
        agent = Sam3Agent()
        
        # Interactive analysis loop
        while True:
            query = input("🔍 What would you like to find? (or 'done' to exit): ").strip()
            
            if query.lower() in ['done', 'exit', 'quit', '']:
                break
            
            print(f"\n⏳ Analyzing image for: {query}...")
            
            response = agent.query(query, image=image_path)
            
            print(f"\n📊 Action: {response.action}")
            print(f"💭 Interpretation: {response.interpretation}")
            print(f"📝 Result: {response.explanation}")
            print(f"🎯 Confidence: {response.confidence:.1%}")
            
            if response.results and hasattr(response.results, 'masks'):
                print(f"🎭 Objects found: {len(response.results.masks)}")
                if response.results.boxes:
                    print("📍 Locations:")
                    for i, box in enumerate(response.results.boxes[:5], 1):
                        print(f"   {i}. Box: ({box[0]}, {box[1]}) to ({box[2]}, {box[3]})")
            
            print()
        
        print("=" * 80)
        print("✅ Vision analysis complete!\n")
        
    except Exception as e:
        print(f"❌ Error analyzing image: {e}\n")


def analyze_video_with_sam3(video_path: str = None):
    """Track objects in a video using SAM 3."""
    if not HAS_SAM3:
        print("❌ SAM 3 Vision not available")
        print("   Install dependencies: pip install pillow numpy torch opencv-python")
        print("   See docs/SAM3_INTEGRATION.md for setup instructions\n")
        return
    
    from src.dexter.tools.sam3 import Sam3VideoProcessor
    
    if not video_path:
        video_path = input("Enter video path to analyze: ").strip()
    
    if not video_path:
        print("❌ No video provided\n")
        return
    
    query = input("Enter object to track (e.g., 'person', 'car'): ").strip()
    if not query:
        query = "objects"
    
    try:
        print(f"\n🎬 SAM 3 VIDEO TRACKING")
        print("=" * 80)
        print(f"Video: {video_path}")
        print(f"Tracking: {query}")
        print()
        
        processor = Sam3VideoProcessor()
        
        print("⏳ Processing video (this may take a while)...")
        
        result = processor.segment_video(
            video_path=video_path,
            query=query,
            max_frames=100  # Limit for demo
        )
        
        print(f"\n📊 Results:")
        print(f"   Total frames processed: {result.total_frames}")
        print(f"   Video FPS: {result.fps:.1f}")
        print(f"   Resolution: {result.resolution[0]}x{result.resolution[1]}")
        print(f"   Objects tracked: {len(result.tracked_objects)}")
        
        for obj in result.tracked_objects:
            coverage = obj.frame_count / result.total_frames * 100
            print(f"\n   🎯 {obj.label} (ID: {obj.object_id})")
            print(f"      Visible in: {obj.frame_count} frames ({coverage:.1f}%)")
            print(f"      Avg confidence: {obj.average_score:.1%}")
        
        print("\n" + "=" * 80)
        print("✅ Video analysis complete!\n")
        
    except Exception as e:
        print(f"❌ Error analyzing video: {e}\n")


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
    sam3_status = "✅" if HAS_SAM3 else "❌"
    print(f"7. 👁️ Vision Analysis (SAM 3) {sam3_status}")
    print(f"8. 🎬 Video Tracking (SAM 3) {sam3_status}")
    print("9. 🚪 Exit")
    print("=" * 80)
    print()


def main():
    """Main entry point for Dark Dexter startup."""
    
    print(DARK_DEXTER_ASCII)
    print("🚀 Initializing Dark Dexter Agent...\n")
    
    # Check API keys status
    check_api_keys()
    
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
