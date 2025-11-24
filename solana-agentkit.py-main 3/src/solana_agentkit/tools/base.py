from abc import ABC, abstractmethod
from typing import Any, Optional, Dict, List
from dataclasses import dataclass
from solana.rpc.async_api import AsyncClient


import logging

from solana_agentkit.utils import keypair
from solana_agentkit.utils.keypair import Keypair

logger = logging.getLogger(__name__)

@dataclass
class ToolResult:
    """Base class for tool operation results."""
    success: bool
    data: Any
    error: Optional[str] = None
    transaction_signature: Optional[str] = None

class BaseTool(ABC):
    """Abstract base class for all Solana tools."""
    
    def __init__(self, name: str):
        self.name = name
        self.description = self.get_description()
        self.connection: Optional[AsyncClient] = None
        self.wallet: Optional[Keypair] = None
        self._initialized = False
        
    @abstractmethod
    def get_description(self) -> str:
        """Get the tool's description."""
        pass
        
    @abstractmethod
    async def _execute(self, *args, **kwargs) -> ToolResult:
        """Execute the tool's main functionality."""
        pass
        
    async def initialize(
        self,
        connection: AsyncClient,
        wallet: keypair
    ) -> None:
        """
        Initialize the tool with connection and wallet.
        
        Args:
            connection: Solana RPC connection
            wallet: Keypair for transactions
        """
        self.connection = connection
        self.wallet = wallet
        self._initialized = True
        await self._post_initialize()
        
    async def _post_initialize(self) -> None:
        """Optional post-initialization hook."""
        pass
        
    async def execute(self, *args, **kwargs) -> ToolResult:
        """
        Execute the tool with error handling.
        
        Returns:
            ToolResult containing execution status and data
        """
        try:
            if not self._initialized:
                raise Exception(f"Tool {self.name} not initialized")
                
            return await self._execute(*args, **kwargs)
            
        except Exception as error:
            logger.error(f"Tool {self.name} execution failed: {error}")
            return ToolResult(
                success=False,
                data=None,
                error=str(error)
            )
            
    def to_dict(self) -> Dict[str, Any]:
        """Convert tool to dictionary format."""
        return {
            "name": self.name,
            "description": self.description,
            "initialized": self._initialized
        }
        
    def __str__(self) -> str:
        return f"{self.name}: {self.description}"

class ChainTool(BaseTool):
    """Base class for blockchain-specific tools."""
    
    def __init__(self, name: str, requires_wallet: bool = True):
        super().__init__(name)
        self.requires_wallet = requires_wallet
        
    async def validate_wallet_state(self) -> None:
        """Validate wallet state before execution."""
        if self.requires_wallet and not self.wallet:
            raise Exception("Wallet required but not provided")
            
    async def _execute(self, *args, **kwargs) -> ToolResult:
        await self.validate_wallet_state()
        return await self.execute_chain_operation(*args, **kwargs)
        
    @abstractmethod
    async def execute_chain_operation(self, *args, **kwargs) -> ToolResult:
        """Execute blockchain-specific operation."""
        pass