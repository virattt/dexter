from typing import List, Type
from rsa import PublicKey, Keypair

from httpx import AsyncClient
from .base import BaseTool, ChainTool, ToolResult
from .transfer import transfer_tokens
from .trading import trade
from .nft import mint_collection_nft
from .domains import register_domain
from .tokens import deploy_token
from .lend import lend_asset
from .get_balance import get_balance
from .image import create_image

__all__ = [
    'BaseTool',
    'ChainTool',
    'ToolResult',
    'transfer_tokens',
    'trade',
    'mint_collection_nft',
    'register_domain',
    'deploy_token',
    'lend_asset',
    'get_balance',
    'create_image',
    'get_available_tools',
    'initialize_tools'
]

def get_available_tools() -> List[Type[BaseTool]]:
    """Get list of all available tools."""
    from .transfer import TransferTool
    from .trading import TradeTool
    from .nft import NFTTool
    from .domains import DomainTool
    from .tokens import TokenTool
    from .lend import LendingTool
    from .get_balance import BalanceTool
    from .image import ImageTool
    
    return [
        TransferTool,
        TradeTool,
        NFTTool,
        DomainTool,
        TokenTool,
        LendingTool,
        BalanceTool,
        ImageTool
    ]

async def initialize_tools(
    connection: AsyncClient,
    wallet: Keypair
) -> List[BaseTool]:
    """
    Initialize all available tools.
    
    Args:
        connection: Solana RPC connection
        wallet: Keypair for transactions
        
    Returns:
        List of initialized tools
    """
    tools = []
    for tool_class in get_available_tools():
        tool = tool_class()
        await tool.initialize(connection, wallet)
        tools.append(tool)
    return tools