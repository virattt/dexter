#!/usr/bin/env python3
"""
Comprehensive GOAT SDK Plugins Example for Dark Dexter.

Demonstrates all available GOAT plugins:
- CoinGecko: Token price data
- DexScreener: DEX trading analytics
- Rugcheck: Solana token security validation
- Nansen: On-chain analytics
- Jupiter: Token swaps
- Lulo: USDC yield deposits

Prerequisites:
- CROSSMINT_API_KEY
- SOLANA_RPC_ENDPOINT
- API keys for specific plugins (CoinGecko, Nansen, etc.) if using API-based features
"""

import os
import asyncio
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate

# Load environment variables
load_dotenv()

from src.dexter.tools.crossmint.wallet import CrossmintWalletManager
from src.dexter.tools.goat_plugins.manager import GOATPluginManager


async def main():
    print("=" * 80)
    print(" DARK DEXTER - GOAT SDK PLUGINS DEMONSTRATION")
    print("=" * 80)
    
    # Initialize wallet
    print("\n1️⃣  Initializing Crossmint Smart Wallet...")
    print("-" * 80)
    
    try:
        wallet_manager = CrossmintWalletManager()
        wallet = wallet_manager.get_or_create_wallet(signer_type="keypair")
        print(f"✅ Wallet address: {wallet.get_address()}")
    except ValueError as e:
        print(f"❌ Error: {e}")
        print("💡 Set CROSSMINT_API_KEY in your .env file")
        return
    
    # Initialize GOAT Plugin Manager
    print("\n2️⃣  Initializing GOAT Plugin Manager...")
    print("-" * 80)
    
    plugin_manager = GOATPluginManager(wallet=wallet)
    
    # Get all available tools
    print("\n3️⃣  Loading All GOAT Plugins...")
    print("-" * 80)
    
    all_tools = plugin_manager.get_all_tools()
    print(f"✅ Loaded {len(all_tools)} tools")
    
    # List available tools
    print("\n4️⃣  Available Tools:")
    print("-" * 80)
    
    tool_names = plugin_manager.list_available_tools()
    for i, name in enumerate(tool_names, 1):
        print(f"   {i}. {name}")
    
    # Demonstrate tool categories
    print("\n5️⃣  Tool Categories:")
    print("-" * 80)
    
    print("\n📊 Market Data Tools (CoinGecko, DexScreener):")
    market_tools = plugin_manager.get_market_data_tools()
    print(f"   {len(market_tools)} tools available")
    
    print("\n🔒 Security Tools (Rugcheck, Nansen):")
    security_tools = plugin_manager.get_security_tools()
    print(f"   {len(security_tools)} tools available")
    
    print("\n💱 Trading Tools (Jupiter):")
    trading_tools = plugin_manager.get_trading_tools()
    print(f"   {len(trading_tools)} tools available")
    
    print("\n💰 Yield Tools (Lulo):")
    yield_tools = plugin_manager.get_yield_tools()
    print(f"   {len(yield_tools)} tools available")
    
    # Initialize LLM and agent (optional - requires OPENAI_API_KEY)
    print("\n6️⃣  AI Agent Integration (Optional):")
    print("-" * 80)
    
    if os.getenv("OPENAI_API_KEY"):
        print("Setting up AI agent with GOAT tools...")
        
        llm = ChatOpenAI(model="gpt-4o-mini")
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", "You are Dark Dexter, an AI agent for Solana DeFi operations. " +
             "You have access to market data, security analysis, trading, and yield tools."),
            ("placeholder", "{chat_history}"),
            ("human", "{input}"),
            ("placeholder", "{agent_scratchpad}"),
        ])
        
        agent = create_tool_calling_agent(llm, all_tools, prompt)
        agent_executor = AgentExecutor(
            agent=agent,
            tools=all_tools,
            handle_parsing_errors=True,
            verbose=True
        )
        
        print("✅ AI agent ready!")
        print("\n💡 Example queries you can ask:")
        print("   - 'What's the price of Solana?'")
        print("   - 'Check if this token is safe: [address]'")
        print("   - 'Swap 1 USDC for SOL'")
        print("   - 'Deposit 5 USDC to Lulo'")
        
        # Interactive mode (commented out - uncomment to enable)
        # while True:
        #     user_input = input("\nYou: ").strip()
        #     if user_input.lower() == "quit":
        #         break
        #     
        #     try:
        #         response = agent_executor.invoke({"input": user_input})
        #         print(f"\nDark Dexter: {response['output']}")
        #     except Exception as e:
        #         print(f"\n❌ Error: {e}")
        
    else:
        print("⚠️  OPENAI_API_KEY not found - skipping AI agent setup")
        print("💡 Set OPENAI_API_KEY to enable interactive AI agent")
    
    # Summary
    print("\n" + "=" * 80)
    print(" SUMMARY")
    print("=" * 80)
    print("\n✅ Successfully integrated GOAT SDK plugins:")
    print("   • CoinGecko - Token price data and market information")
    print("   • DexScreener - DEX trading data and analytics")
    print("   • Rugcheck - Solana token security validation")
    print("   • Nansen - On-chain analytics and insights")
    print("   • Jupiter - Token swaps on Solana")
    print("   • Lulo - USDC yield deposits")
    print()
    print("🚀 Dark Dexter is now a fully-featured Solana DeFi agent!")
    print()
    print("📚 Next Steps:")
    print("   1. Fund your wallet with SOL for gas fees")
    print("   2. Add USDC for swaps and yield deposits")
    print("   3. Set OPENAI_API_KEY for AI agent interactions")
    print("   4. Explore each plugin's capabilities")
    print()
    print("📖 Documentation:")
    print("   - Crossmint: docs/CROSSMINT_INTEGRATION.md")
    print("   - Dark Dexter: docs/DARK_DEXTER.md")
    print("   - Helius: docs/HELIUS_INTEGRATION.md")
    print()


if __name__ == "__main__":
    asyncio.run(main())
