# src/solana_agentkit/tools/request_faucet_funds.py

from typing import Optional
from solana.rpc.commitment import Confirmed
from spl.token.constants import LAMPORTS_PER_SOL
import logging
import base58

from solana_agentkit.agent.solana_agent import SolanaAgent

logger = logging.getLogger(__name__)

async def request_faucet_funds(
    agent: 'SolanaAgent',
    amount_sol: float = 5.0
) -> str:
    """
    Request SOL from the Solana faucet (devnet/testnet only).
    
    Args:
        agent: SolanaAgentKit instance
        amount_sol: Amount of SOL to request (default: 5)
        
    Returns:
        Transaction signature
        
    Raises:
        Exception: If request fails or times out
    """
    try:
        # Convert SOL to lamports
        amount_lamports = int(amount_sol * LAMPORTS_PER_SOL)
        
        # Request airdrop
        signature = await agent.connection.request_airdrop(
            agent.wallet_address,
            amount_lamports,
            Confirmed
        )
        
        if not signature:
            raise Exception("Airdrop request failed")
            
        # Get latest blockhash for confirmation
        latest_blockhash = await agent.connection.get_latest_blockhash()
        
        # Confirm transaction
        await agent.connection.confirm_transaction(
            signature.value,
            commitment=Confirmed
        )
        
        # Encode signature as base58
        tx_signature = base58.b58encode(signature.value).decode('ascii')
        
        logger.info(f"Successfully received {amount_sol} SOL from faucet")
        return tx_signature
        
    except Exception as error:
        raise Exception(f"Faucet request failed: {str(error)}") from error

class FaucetRequester:
    """Helper class for managing faucet requests."""
    
    def __init__(self, agent: 'SolanaAgent'):
        self.agent = agent
        self._total_requested = 0.0
        
    async def request_funds(
        self,
        amount_sol: float = 5.0,
        max_retries: int = 3
    ) -> str:
        """
        Request funds with retry logic.
        
        Args:
            amount_sol: Amount of SOL to request
            max_retries: Maximum number of retry attempts
            
        Returns:
            Transaction signature
        """
        attempt = 0
        last_error = None
        
        while attempt < max_retries:
            try:
                signature = await request_faucet_funds(self.agent, amount_sol)
                self._total_requested += amount_sol
                return signature
            except Exception as error:
                last_error = error
                attempt += 1
                logger.warning(f"Faucet request attempt {attempt} failed: {error}")
        
        raise Exception(f"Failed after {max_retries} attempts. Last error: {last_error}")
    
    async def get_current_balance(self) -> float:
        """Get current wallet balance in SOL."""
        try:
            balance = await self.agent.connection.get_balance(
                self.agent.wallet_address,
                commitment=Confirmed
            )
            return balance.value / LAMPORTS_PER_SOL
        except Exception as error:
            logger.error(f"Failed to get balance: {error}")
            return 0.0
    
    async def request_until_balance(
        self,
        target_balance: float,
        max_requests: int = 3
    ) -> Optional[str]:
        """
        Request funds until reaching target balance.
        
        Args:
            target_balance: Target balance in SOL
            max_requests: Maximum number of requests to make
            
        Returns:
            Last transaction signature or None if target wasn't reached
        """
        current_balance = await self.get_current_balance()
        last_signature = None
        requests_made = 0
        
        while current_balance < target_balance and requests_made < max_requests:
            needed = min(5.0, target_balance - current_balance)  # Cap at 5 SOL per request
            try:
                last_signature = await self.request_funds(needed)
                requests_made += 1
                current_balance = await self.get_current_balance()
            except Exception as error:
                logger.error(f"Failed to reach target balance: {error}")
                break
                
        return last_signature if current_balance >= target_balance else None