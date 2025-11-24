# src/solana_agentkit/agent/base.py

from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass
from rsa import PublicKey
from solana.rpc.api import Client
from langchain.llms import BaseLLM
from langchain.schema import BaseMemory
from enum import Enum

from solana_agentkit.utils import keypair

class AgentRole(Enum):
    """Defines possible roles for Solana agents."""
    TRADER = "trader"
    NFT_MANAGER = "nft_manager"
    TOKEN_MANAGER = "token_manager"
    PORTFOLIO_MANAGER = "portfolio_manager"
    GENERAL = "general"

@dataclass
class AgentConfig:
    """Configuration settings for Solana agents."""
    role: AgentRole = AgentRole.GENERAL
    max_parallel_tasks: int = 5
    auto_retry_count: int = 3
    default_slippage_bps: int = 50
    simulation_mode: bool = False
    max_transaction_size: int = 1232
    log_level: str = "INFO"

class BaseSolanaAgent(ABC):
    """
    Abstract base class for Solana agents.
    Defines the core interface and shared functionality for all agents.
    """
    
    def __init__(
        self,
        private_key: str,
        llm: Optional[BaseLLM] = None,
        rpc_url: str = "https://api.mainnet-beta.solana.com",
        config: Optional[AgentConfig] = None,
        memory: Optional[BaseMemory] = None
    ):
        """
        Initialize base agent components.
        
        Args:
            private_key: Base58 encoded private key
            llm: Optional language model for AI capabilities
            rpc_url: Solana RPC endpoint URL
            config: Agent configuration settings
            memory: Optional memory store for maintaining context
        """
        # Core components
        self.connection = Client(rpc_url)
        self.wallet = keypair.from_secret_key(bytes(private_key))
        self.wallet_address = self.wallet.public_key
        
        # AI components
        self.llm = llm
        self.memory = memory
        
        # Configuration
        self.config = config or AgentConfig()
        
        # State management
        self.tools: List[Any] = []
        self._active_tasks: Dict[str, Any] = {}
        self._transaction_history: List[Dict[str, Any]] = []

    @abstractmethod
    async def initialize(self) -> None:
        """Initialize agent resources and connections."""
        pass

    @abstractmethod
    async def process_message(self, message: str) -> Dict[str, Any]:
        """
        Process an incoming message and execute appropriate actions.
        
        Args:
            message: User input message
            
        Returns:
            Dictionary containing response and any action results
        """
        pass

    async def add_tool(self, tool: Any) -> None:
        """
        Add a tool to the agent's capabilities.
        
        Args:
            tool: Tool instance to add
        """
        if tool not in self.tools:
            self.tools.append(tool)
            await self._initialize_tool(tool)

    async def _initialize_tool(self, tool: Any) -> None:
        """
        Initialize a tool with agent context.
        
        Args:
            tool: Tool to initialize
        """
        if hasattr(tool, 'initialize'):
            await tool.initialize(self.connection, self.wallet)

    async def get_balance(
        self,
        token_address: Optional[PublicKey] = None
    ) -> Union[int, float]:
        """
        Get wallet balance for SOL or specified token.
        
        Args:
            token_address: Optional token mint address
            
        Returns:
            Current balance
        """
        if token_address:
            # Get SPL token balance
            response = await self.connection.get_token_account_balance(token_address)
            return float(response['result']['value']['uiAmount'])
        else:
            # Get SOL balance
            response = await self.connection.get_balance(self.wallet_address)
            return float(response['result']['value']) / 1e9

    async def validate_transaction(
        self,
        transaction: Dict[str, Any]
    ) -> bool:
        """
        Validate a transaction before execution.
        
        Args:
            transaction: Transaction details to validate
            
        Returns:
            Boolean indicating if transaction is valid
        """
        # Implement transaction validation logic
        if self.config.simulation_mode:
            return True
            
        # Add your validation logic here
        return True

    async def record_transaction(
        self,
        transaction: Dict[str, Any]
    ) -> None:
        """
        Record a transaction in the agent's history.
        
        Args:
            transaction: Transaction details to record
        """
        self._transaction_history.append({
            **transaction,
            'timestamp': self.connection.get_block_time()
        })

    async def cleanup(self) -> None:
        """Clean up agent resources."""
        # Cleanup tools
        for tool in self.tools:
            if hasattr(tool, 'cleanup'):
                await tool.cleanup()
        
        # Clear state
        self._active_tasks.clear()
        
        # Close connections
        if hasattr(self.connection, 'close'):
            await self.connection.close()

    def __repr__(self) -> str:
        """String representation of the agent."""
        return f"{self.__class__.__name__}(role={self.config.role.value})"