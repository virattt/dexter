import os
import pytest
import asyncio
from dotenv import load_dotenv
from solana.rpc.api import Client as SolanaClient
from solders.keypair import Keypair
from goat_wallets.solana import solana
from goat_plugins.lulo import lulo, LuloPluginOptions

# Load environment variables
load_dotenv()

@pytest.mark.asyncio
async def test_deposit_usdc():
    # Initialize Solana client and wallet
    client = SolanaClient(os.getenv("SOLANA_RPC_ENDPOINT"))
    keypair = Keypair.from_base58_string(os.getenv("SOLANA_WALLET_SEED") or "")
    wallet = solana(client, keypair)
    
    # Initialize Lulo plugin
    plugin = lulo(LuloPluginOptions())
    
    # Get deposit_usdc tool
    tools = plugin.get_tools(wallet)
    for tool in tools:
        print(f"Found tool: {tool.name}")
    deposit_tool = next((tool for tool in tools if tool.name == "deposit_usdc"), None)
    
    assert deposit_tool is not None, "Deposit tool not found"
    
    # Test deposit (this will make a real API call, so use with caution)
    # result = await deposit_tool.func({"amount": "1"})
    # assert result is not None
