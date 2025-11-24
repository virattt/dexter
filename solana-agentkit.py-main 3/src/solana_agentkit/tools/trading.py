# src/solana_agentkit/tools/trade.py

from typing import Optional, Dict, Any
from dataclasses import dataclass
import aiohttp
import base64
import base58
from rsa import PublicKey
from solana.transaction import VersionedTransaction
from solana.rpc.commitment import Confirmed
from spl.token.constants import LAMPORTS_PER_SOL

from solana_agentkit.agent.solana_agent import SolanaAgent
from ..constants import TOKENS, DEFAULT_OPTIONS, JUP_API
import logging

logger = logging.getLogger(__name__)

@dataclass
class SwapQuote:
    """Jupiter swap quote information."""
    input_mint: str
    output_mint: str
    amount: int
    slippage_bps: int
    routes: list
    price_impact_pct: float

@dataclass
class SwapResult:
    """Result of a swap operation."""
    signature: str
    input_amount: float
    output_amount: float
    price_impact: float
    fee: float

async def trade(
    agent: 'SolanaAgent',
    output_mint: PublicKey,
    input_amount: float,
    input_mint: PublicKey = TOKENS.USDC,
    slippage_bps: int = DEFAULT_OPTIONS.SLIPPAGE_BPS
) -> str:
    """
    Swap tokens using Jupiter Exchange.
    
    Args:
        agent: SolanaAgentKit instance
        output_mint: Target token mint address
        input_amount: Amount to swap (in token decimals)
        input_mint: Source token mint address (defaults to USDC)
        slippage_bps: Slippage tolerance in basis points (default: 300 = 3%)
        
    Returns:
        Transaction signature
        
    Raises:
        Exception: If swap fails
    """
    try:
        logger.info(f"Getting quote for {input_amount} {input_mint} to {output_mint}")
        
        # Format quote URL
        quote_url = (
            f"{JUP_API}/quote?"
            f"inputMint={str(input_mint)}&"
            f"outputMint={str(output_mint)}&"
            f"amount={int(input_amount * LAMPORTS_PER_SOL)}&"
            f"slippageBps={slippage_bps}&"
            f"onlyDirectRoutes=true&"
            f"maxAccounts=20"
        )
        
        async with aiohttp.ClientSession() as session:
            # Get quote
            async with session.get(quote_url) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise Exception(f"Quote failed: {error_text}")
                quote_response = await response.json()
                
            logger.info("Getting swap transaction")
            
            # Get swap transaction
            swap_request = {
                "quoteResponse": quote_response,
                "userPublicKey": str(agent.wallet_address),
                "wrapAndUnwrapSol": True,
                "dynamicComputeUnitLimit": True,
                "prioritizationFeeLamports": "auto"
            }
            
            async with session.post(
                "https://quote-api.jup.ag/v6/swap",
                json=swap_request
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise Exception(f"Swap transaction failed: {error_text}")
                    
                swap_data = await response.json()
                
            # Deserialize transaction
            tx_data = base64.b64decode(swap_data["swapTransaction"])
            transaction = VersionedTransaction.deserialize(tx_data)
            
            # Sign and send transaction
            transaction.sign([agent.wallet])
            
            result = await agent.connection.send_transaction(
                transaction,
                [agent.wallet],
                opts={
                    "skip_preflight": False,
                    "preflight_commitment": Confirmed,
                    "max_retries": 3
                }
            )
            
            signature = result.value.signature
            
            # Wait for confirmation
            await agent.connection.confirm_transaction(
                signature,
                commitment=Confirmed
            )
            
            logger.info(f"Swap completed: {base58.b58encode(signature).decode('ascii')}")
            return base58.b58encode(signature).decode('ascii')
            
    except Exception as error:
        raise Exception(f"Swap failed: {str(error)}") from error

class JupiterTrader:
    """Helper class for trading on Jupiter."""
    
    def __init__(self, agent: 'SolanaAgent'):
        self.agent = agent
        
    async def get_quote(
        self,
        output_mint: PublicKey,
        input_amount: float,
        input_mint: PublicKey = TOKENS.USDC,
        slippage_bps: int = DEFAULT_OPTIONS.SLIPPAGE_BPS
    ) -> SwapQuote:
        """Get a quote for a swap without executing it."""
        quote_url = (
            f"{JUP_API}/quote?"
            f"inputMint={str(input_mint)}&"
            f"outputMint={str(output_mint)}&"
            f"amount={int(input_amount * LAMPORTS_PER_SOL)}&"
            f"slippageBps={slippage_bps}"
        )
        
        async with aiohttp.ClientSession() as session:
            async with session.get(quote_url) as response:
                if response.status != 200:
                    raise Exception(await response.text())
                data = await response.json()
                
                return SwapQuote(
                    input_mint=str(input_mint),
                    output_mint=str(output_mint),
                    amount=input_amount,
                    slippage_bps=slippage_bps,
                    routes=data.get('routes', []),
                    price_impact_pct=float(data.get('priceImpactPct', 0))
                )
    
    async def execute_swap(
        self,
        quote: SwapQuote
    ) -> SwapResult:
        """Execute a swap based on a quote."""
        signature = await trade(
            self.agent,
            PublicKey(quote.output_mint),
            quote.amount,
            PublicKey(quote.input_mint),
            quote.slippage_bps
        )
        
        # Get swap details from transaction
        tx_details = await self.agent.connection.get_transaction(
            base58.b58decode(signature),
            commitment=Confirmed
        )
        
        return SwapResult(
            signature=signature,
            input_amount=quote.amount,
            output_amount=tx_details.value.meta.post_token_balances[0].ui_amount,
            price_impact=quote.price_impact_pct,
            fee=tx_details.value.meta.fee / LAMPORTS_PER_SOL
        )