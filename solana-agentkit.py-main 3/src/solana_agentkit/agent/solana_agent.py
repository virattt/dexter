# src/solana_agentkit/agent/solana_agent.py

from typing import Optional, Dict, Any, Union, List
from dataclasses import dataclass
from rsa import PublicKey
from solana.rpc.api import Client
import base58
from langchain.llms import BaseLLM
from langchain.agents import Tool
from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate
#from solana.publickey import PublicKey
from solana_agentkit.utils import keypair
from .base import BaseAgent
#from solders.pubkey import Pubkey as PublicKey
from solana.rpc.async_api import AsyncClient
from solders.keypair import Keypair  # type: ignore
from solders.pubkey import Pubkey  # type: ignore

from solana_agentkit.constants.constants import DEFAULT_OPTIONS
from solana_agentkit.types import PumpfunTokenOptions
from solana_agentkit.meteora.types import ActivationType

@dataclass
class CollectionOptions:
    """Options for deploying an NFT collection."""
    name: str
    symbol: str
    description: str
    image_url: str
    seller_fee_basis_points: int = 0

@dataclass
class PumpFunTokenOptions:
    """Options for launching a PumpFun token."""
    max_supply: Optional[int] = None
    initial_price: Optional[float] = None
    liquidity_percentage: Optional[float] = None

class SolanaAgent(BaseAgent):
    """
    AI-powered agent for interacting with the Solana blockchain.
    Combines LangChain capabilities with Solana operations.
    """
    
    def __init__(
        self,
        private_key: str,
        llm: BaseLLM,
        rpc_url: str = "https://api.mainnet-beta.solana.com",
        openai_api_key: Optional[str] = None
    ):
        """
        Initialize Solana Agent.
        
        Args:
            private_key: Base58 encoded private key
            llm: Language model for agent reasoning
            rpc_url: Solana RPC endpoint URL
            openai_api_key: OpenAI API key for AI features
        """
        super().__init__(keypair=keypair.from_secret_key(base58.b58decode(private_key)), rpc_url=rpc_url)
        self.wallet_address = self.keypair.public_key
        self.openai_api_key = openai_api_key
        
        # AI setup
        self.llm = llm
        self.tools = self._initialize_tools()
        self.agent_chain = self._create_agent_chain()

    def _initialize_tools(self) -> List[Tool]:
        """Initialize available tools for the agent."""
        return [
            Tool(
                name="deploy_token",
                func=self.deploy_token,
                description="Deploy a new SPL token with specified decimals"
            ),
            Tool(
                name="deploy_collection",
                func=self.deploy_collection,
                description="Deploy a new NFT collection with specified options"
            ),
            Tool(
                name="get_balance",
                func=self.get_balance,
                description="Get wallet balance for SOL or SPL token"
            ),
            # Add other tools here
        ]

    def _create_agent_chain(self) -> LLMChain:
        """Create the main agent reasoning chain."""
        template = """You are a Solana blockchain agent with the following capabilities:
        - Deploy tokens and NFT collections
        - Execute trades and transfers
        - Manage domains and other blockchain operations
        
        User request: {input}
        
        Think through the steps needed and use available tools to fulfill this request.
        
        Available tools: {tools}
        
        Response:"""
        
        prompt = PromptTemplate(
            input_variables=["input", "tools"],
            template=template
        )
        
        return LLMChain(
            llm=self.llm,
            prompt=prompt
        )

    async def process_message(self, message: str) -> str:
        """
        Process a user message and execute requested operations.
        
        Args:
            message: User input message
            
        Returns:
            Agent response and action results
        """
        # Use LLM to understand intent
        response = await self.agent_chain.arun(
            input=message,
            tools=", ".join(tool.name for tool in self.tools)
        )
        
        # Execute determined actions
        # This is a simplified implementation - you might want to add
        # more sophisticated action parsing and execution logic
        return response

    # Blockchain operation methods
    async def deploy_token(
        self,
        decimals: int = 9
    ) -> Dict[str, Any]:
        """Deploy a new SPL token."""
        from ..tools import deploy_token
        return await deploy_token(self, decimals)

    async def deploy_collection(
        self,
        options: CollectionOptions
    ) -> Dict[str, Any]:
        """Deploy an NFT collection."""
        from ..tools import deploy_collection
        return await deploy_collection(self, options)

    async def get_balance(
        self,
        token_address: Optional[PublicKey] = None
    ) -> Union[int, float]:
        """Get wallet balance."""
        from ..tools import get_balance
        return await get_balance(self, token_address)

    async def mint_nft(
        self,
        collection_mint: PublicKey,
        metadata: Dict[str, Any],
        recipient: Optional[PublicKey] = None
    ) -> Dict[str, Any]:
        """Mint an NFT from a collection."""
        from ..tools import mint_collection_nft
        return await mint_collection_nft(self, collection_mint, metadata, recipient)

    async def transfer(
        self,
        to: PublicKey,
        amount: float,
        mint: Optional[PublicKey] = None
    ) -> Dict[str, Any]:
        """Transfer SOL or tokens."""
        from ..tools import transfer
        return await transfer(self, to, amount, mint)

    async def trade(
        self,
        output_mint: PublicKey,
        input_amount: float,
        input_mint: Optional[PublicKey] = None,
        slippage_bps: int = 50
    ) -> Dict[str, Any]:
        """Execute a token swap."""
        from ..tools import trade
        return await trade(self, output_mint, input_amount, input_mint, slippage_bps)

    async def launch_pumpfun_token(
        self,
        token_name: str,
        token_ticker: str,
        description: str,
        image_url: str,
        options: Optional[PumpFunTokenOptions] = None
    ) -> Dict[str, Any]:
        """Launch a PumpFun token."""
        from ..tools import launch_pumpfun_token
        return await launch_pumpfun_token(
            self,
            token_name,
            token_ticker,
            description,
            image_url,
            options
        )

class SolanaAgentKit:
    """
    Main class for interacting with Solana blockchain.
    Provides a unified interface for token operations, NFT management, and trading.

    Attributes:
        connection (AsyncClient): Solana RPC connection.
        wallet (Keypair): Wallet keypair for signing transactions.
        wallet_address (Pubkey): Public key of the wallet.
        openai_api_key (str): OpenAI API key for additional functionality.
    """

    def __init__(self, private_key: str, rpc_url: str = "https://api.mainnet-beta.solana.com", openai_api_key: str = ""):
        self.connection = AsyncClient(rpc_url)
        self.wallet = Keypair.from_base58_string(private_key)
        self.wallet_address = self.wallet.pubkey()
        self.openai_api_key = openai_api_key
        self.rpc_url = rpc_url

    async def request_faucet_funds(self):
        from solana_agentkit.tools.request_faucet_funds import FaucetManager
        return await FaucetManager.request_faucet_funds(self)

    async def deploy_token(self, decimals: int = DEFAULT_OPTIONS["TOKEN_DECIMALS"]):
        from solana_agentkit.tools.deploy_token import TokenDeploymentManager
        return await TokenDeploymentManager.deploy_token(self, decimals)

    async def get_balance(self, token_address: Pubkey = None):
        from solana_agentkit.tools.get_balance import BalanceFetcher
        return await BalanceFetcher.get_balance(self, token_address)
    
    async def fetch_price(self, token_id: str):
        from solana_agentkit.tools.fetch_price import TokenPriceFetcher
        return await TokenPriceFetcher.fetch_price(token_id)

    async def transfer(self, to: Pubkey, amount: int, mint: Pubkey = None):
        from solana_agentkit.tools.transfer import TokenTransferManager
        return await TokenTransferManager.execute_transfer(self, to, amount, mint)

    async def trade(self, output_mint: Pubkey, input_amount: int, input_mint: Pubkey = None, slippage_bps: int = DEFAULT_OPTIONS["SLIPPAGE_BPS"]):
        from solana_agentkit.tools.trade import TradeManager
        return await TradeManager.trade(self, output_mint, input_amount, input_mint, slippage_bps)

    async def lend_assets(self, amount: int):
        from solana_agentkit.tools.lend import AssetLender
        return await AssetLender.lend(self, amount)

    async def get_tps(self):
        from solana_agentkit.tools.get_tps import SolanaPerformanceTracker
        return await SolanaPerformanceTracker.fetch_current_tps(self)
    
    async def get_token_data_by_ticker(self, ticker: str):
        from solana_agentkit.tools.get_token_data import TokenDataManager
        return TokenDataManager.get_token_data_by_ticker(ticker)
    
    async def get_token_data_by_address(self, mint: str):
        from solana_agentkit.tools.get_token_data import TokenDataManager
        return TokenDataManager.get_token_data_by_address(Pubkey.from_string(mint))

    async def launch_pump_fun_token(self, token_name: str, token_ticker: str, description: str, image_url: str, options: PumpfunTokenOptions = None):
        from solana_agentkit.tools.launch_pumpfun_token import PumpfunTokenManager
        return await PumpfunTokenManager.launch_pumpfun_token(self, token_name, token_ticker, description, image_url, options)

    async def stake(self, amount: int):
        from solana_agentkit.tools.stake_with_jup import StakeManager
        return await StakeManager.stake_with_jup(self, amount)
    
    async def create_meteora_dlmm_pool(self, bin_step: int, token_a_mint: Pubkey, token_b_mint: Pubkey, initial_price: float, price_rounding_up: bool, fee_bps: int, activation_type: ActivationType, has_alpha_vault: bool, activation_point: Optional[int]):
        from solana_agentkit.tools.create_meteora_dlmm_pool import MeteoraManager
        return await MeteoraManager.create_meteora_dlmm_pool(self, bin_step, token_a_mint, token_b_mint, initial_price, price_rounding_up, fee_bps, activation_type, has_alpha_vault, activation_point)
    
    async def buy_with_raydium(self, pair_address: str, sol_in: float = .01, slippage: int = 5):
        from solana_agentkit.tools.use_raydium import RaydiumManager
        return RaydiumManager.buy_with_raydium(self, pair_address, sol_in, slippage)
    
    async def sell_with_raydium(self, pair_address: str, percentage: int = 100, slippage: int = 5):
        from solana_agentkit.tools.use_raydium import RaydiumManager
        return RaydiumManager.sell_with_raydium(self, pair_address, percentage, slippage)
    
    async def burn_and_close_accounts(self, token_account: str):
        from solana_agentkit.tools.burn_and_close_account import BurnManager
        return BurnManager.burn_and_close_account(self, token_account)
    
    async def multiple_burn_and_close_accounts(self, token_accounts):
        from solana_agentkit.tools.burn_and_close_account import BurnManager
        return BurnManager.process_multiple_accounts(self, token_accounts)