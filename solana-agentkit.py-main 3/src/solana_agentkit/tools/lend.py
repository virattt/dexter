# src/solana_agentkit/tools/lend.py

from typing import Dict, Any, Optional
from dataclasses import dataclass
import base64
import aiohttp
from rsa import PublicKey
from solana.transaction import VersionedTransaction
from solana.rpc.commitment import Confirmed

from solana_agentkit.agent.solana_agent import SolanaAgent
from ..constants import LULO_API
from ..utils.transaction import get_priority_fees

@dataclass
class LendingPosition:
    """Details about a lending position."""
    asset: str
    amount: float
    apy: float
    accrued_interest: float

@dataclass
class LuloAccountDetails:
    """Response from Lulo API about account details."""
    total_deposited_value: float
    total_borrowed_value: float
    net_apy: float
    health_factor: float
    positions: list[LendingPosition]

async def lend_asset(
    agent: 'SolanaAgent',
    asset: PublicKey,
    amount: float,
    lulo_api_key: str
) -> str:
    """
    Lend tokens for yields using Lulo.
    
    Args:
        agent: SolanaAgentKit instance
        asset: Mint address of the token to lend
        amount: Amount to lend (in token decimals)
        lulo_api_key: Valid API key for Lulo
        
    Returns:
        Transaction signature
        
    Raises:
        Exception: If lending operation fails
    """
    try:
        if not lulo_api_key:
            raise ValueError("Missing Lulo API key")
            
        # Prepare request data
        request_data = {
            "owner": str(agent.wallet_address),
            "mintAddress": str(asset),
            "depositAmount": str(amount)
        }
        
        # Get priority fees
        priority_fees = await get_priority_fees(agent.connection)
        priority_param = f"?priorityFee={priority_fees['median']}"
        
        # Make API request
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{LULO_API}/generate/account/deposit{priority_param}",
                headers={
                    "Content-Type": "application/json",
                    "x-wallet-pubkey": str(agent.wallet_address),
                    "x-api-key": lulo_api_key
                },
                json=request_data
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise Exception(f"Lulo API error: {error_text}")
                    
                data = await response.json()
                transaction_meta = data['data']['transactionMeta'][0]
                
                # Deserialize and process transaction
                tx_data = base64.b64decode(transaction_meta['transaction'])
                lulo_tx = VersionedTransaction.deserialize(tx_data)
                
                # Sign transaction
                lulo_tx.sign([agent.wallet])
                
                # Send transaction
                signature = await agent.connection.send_transaction(
                    lulo_tx,
                    [agent.wallet],
                    opts={
                        "skip_preflight": False,
                        "preflight_commitment": Confirmed,
                        "max_retries": 3
                    }
                )
                
                # Wait for confirmation
                await agent.connection.confirm_transaction(signature, Confirmed)
                
                return str(signature)
                
    except Exception as error:
        raise Exception(f"Lending failed: {str(error)}") from error

async def get_lending_details(
    agent: 'SolanaAgent',
    lulo_api_key: str
) -> LuloAccountDetails:
    """
    Fetch lending details for agent from Lulo.
    
    Args:
        agent: SolanaAgentKit instance
        lulo_api_key: Valid API key for Lulo
        
    Returns:
        LuloAccountDetails containing lending account information
        
    Raises:
        Exception: If fetching details fails
    """
    try:
        if not lulo_api_key:
            raise ValueError("Missing Lulo API key")
            
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{LULO_API}/account",
                headers={
                    "x-wallet-pubkey": str(agent.wallet_address),
                    "x-api-key": lulo_api_key
                }
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise Exception(f"Lulo API error: {error_text}")
                    
                data = await response.json()
                account_data = data['data']
                
                # Parse positions
                positions = [
                    LendingPosition(
                        asset=pos['asset'],
                        amount=float(pos['amount']),
                        apy=float(pos['apy']),
                        accrued_interest=float(pos['accruedInterest'])
                    )
                    for pos in account_data.get('positions', [])
                ]
                
                return LuloAccountDetails(
                    total_deposited_value=float(account_data['totalDepositedValue']),
                    total_borrowed_value=float(account_data['totalBorrowedValue']),
                    net_apy=float(account_data['netApy']),
                    health_factor=float(account_data['healthFactor']),
                    positions=positions
                )
                
    except Exception as error:
        raise Exception(f"Failed to fetch lending details: {str(error)}") from error

class LuloLendingManager:
    """Helper class for managing Lulo lending operations."""
    
    def __init__(self, agent: 'SolanaAgent', api_key: str):
        self.agent = agent
        self.api_key = api_key
        
    async def deposit(
        self,
        asset: PublicKey,
        amount: float
    ) -> str:
        """Deposit assets into Lulo lending."""
        return await lend_asset(self.agent, asset, amount, self.api_key)
        
    async def get_account_info(self) -> LuloAccountDetails:
        """Get current lending account information."""
        return await get_lending_details(self.agent, self.api_key)
        
    async def calculate_earnings(self) -> Dict[str, float]:
        """Calculate current earnings from lending positions."""
        details = await self.get_account_info()
        return {
            pos.asset: pos.accrued_interest
            for pos in details.positions
        }