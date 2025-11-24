#!/usr/bin/env python3
"""
Example script demonstrating Crossmint Smart Wallet integration with Dark Dexter.

This script shows how to:
1. Create/load a Crossmint Smart Wallet
2. Check wallet balance
3. Send memo transactions
4. Swap tokens using Jupiter
5. Deposit USDC to Lulo for yield

Prerequisites:
- CROSSMINT_API_KEY environment variable
- CROSSMINT_BASE_URL environment variable (optional, defaults to staging)
- SOLANA_RPC_ENDPOINT environment variable (optional, defaults to devnet)
"""

import os
import asyncio
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from src.dexter.tools.crossmint.wallet import CrossmintWalletManager
from src.dexter.tools.crossmint.operations import CrossmintOperations


async def main():
    print("=" * 80)
    print(" DARK DEXTER - CROSSMINT SMART WALLET EXAMPLE")
    print("=" * 80)
    
    # Initialize wallet manager
    try:
        manager = CrossmintWalletManager()
    except ValueError as e:
        print(f"\n❌ Error: {e}")
        print("\n💡 Please set CROSSMINT_API_KEY in your .env file")
        return
    
    # Get or create wallet
    print("\n1️⃣  Creating/Loading Crossmint Smart Wallet...")
    print("-" * 80)
    
    wallet = manager.get_or_create_wallet(
        signer_type="keypair",  # Use "fireblocks" for MPC custodial
        linked_user=None  # Optional: "email:user@example.com"
    )
    
    # Check balance
    print("\n2️⃣  Checking Wallet Balance...")
    print("-" * 80)
    
    balances = manager.get_wallet_balance(wallet, tokens=["sol", "usdc"])
    
    for balance in balances:
        token = balance.get("token", "Unknown").upper()
        total = balance.get("balances", {}).get("total", 0)
        
        if token == "SOL":
            ui_amount = int(total) / 1e9  # SOL has 9 decimals
        else:
            ui_amount = int(total) / 1e6  # Most tokens have 6 decimals
        
        print(f"💰 {token}: {ui_amount}")
    
    # Send memo transaction
    print("\n3️⃣  Sending Memo Transaction...")
    print("-" * 80)
    
    try:
        memo_response = CrossmintOperations.send_memo(
            wallet,
            "Hello from Dark Dexter! 🌑"
        )
        print(f"View transaction: https://solscan.io/tx/{memo_response.get('hash')}?cluster=devnet")
    except Exception as e:
        print(f"⚠️  Error sending memo: {e}")
    
    # Example: Swap tokens (commented out - requires mainnet and funding)
    print("\n4️⃣  Token Swap Example (Jupiter)")
    print("-" * 80)
    print("💡 To swap tokens:")
    print("   1. Switch to mainnet (set CROSSMINT_BASE_URL=https://www.crossmint.com)")
    print("   2. Fund your wallet with USDC")
    print("   3. Run the swap:")
    print()
    print("   # Example: Swap 1 USDC for MOTHER")
    print("   usdc_mint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'")
    print("   mother_mint = '3S8qX1MsMqRbiwKg2cQyx7nis1oHMgaCuc9c4VfvVdPN'")
    print("   await CrossmintOperations.swap_tokens(")
    print("       wallet, usdc_mint, mother_mint, int(1 * 1e6), slippage_bps=100")
    print("   )")
    
    # Example: Lulo yield deposit (commented out - requires mainnet and funding)
    print("\n5️⃣  Lulo Yield Deposit Example")
    print("-" * 80)
    print("💡 To deposit to Lulo:")
    print("   1. Switch to mainnet")
    print("   2. Fund your wallet with USDC")
    print("   3. Run the deposit:")
    print()
    print("   # Example: Deposit 5 USDC to Lulo")
    print("   await CrossmintOperations.deposit_to_lulo(wallet, amount_usdc=5.0)")
    
    print("\n" + "=" * 80)
    print("✨ Example completed successfully!")
    print("=" * 80)
    print()
    print("📁 Wallet config saved to: ~/.dexter/crossmint_wallet.json")
    print("🌐 View your wallet on Solana Explorer:")
    print(f"   https://explorer.solana.com/address/{wallet.get_address()}?cluster=devnet")
    print()


if __name__ == "__main__":
    asyncio.run(main())
