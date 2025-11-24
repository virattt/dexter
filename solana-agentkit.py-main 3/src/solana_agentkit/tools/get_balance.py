# src/solana_agentkit/tools/get_balance.py

from typing import Optional, Union
from rsa import PublicKey
from solana.rpc.commitment import Confirmed
from solana_agentkit import SolanaAgentKit
from spl.token.constants import LAMPORTS_PER_SOL

async def get_balance(
    agent: 'SolanaAgentKit',
    token_address: Optional[PublicKey] = None
) -> Optional[float]:
    """
    Get the balance of SOL or an SPL token for the agent's wallet.
    
    Args:
        agent: SolanaAgentKit instance
        token_address: Optional SPL token mint address. If not provided, returns SOL balance
        
    Returns:
        Balance as a float in UI units, or None if account doesn't exist
        
    Raises:
        Exception: If balance check fails
    """
    try:
        if token_address is None:
            # Get SOL balance
            response = await agent.connection.get_balance(
                agent.wallet_address,
                commitment=Confirmed
            )
            # Convert lamports to SOL
            return response.value / LAMPORTS_PER_SOL
        else:
            # Get SPL token balance
            response = await agent.connection.get_token_account_balance(
                token_address,
                commitment=Confirmed
            )
            
            if response.value is None:
                return None
                
            return float(response.value.ui_amount)
            
    except Exception as error:
        raise Exception(f"Failed to get balance: {str(error)}") from error

async def get_token_accounts(
    agent: 'SolanaAgentKit',
    token_address: PublicKey
) -> list:
    """
    Get all token accounts owned by the wallet for a specific token.
    
    Args:
        agent: SolanaAgentKit instance
        token_address: Token mint address
        
    Returns:
        List of token account addresses
    """
    try:
        response = await agent.connection.get_token_accounts_by_owner(
            agent.wallet_address,
            {'mint': token_address}
        )
        
        return [account.pubkey for account in response.value]
    except Exception as error:
        raise Exception(f"Failed to get token accounts: {str(error)}") from error

async def get_all_token_balances(
    agent: 'SolanaAgentKit'
) -> dict:
    """
    Get balances for all tokens owned by the wallet.
    
    Args:
        agent: SolanaAgentKit instance
        
    Returns:
        Dictionary mapping token addresses to their balances
    """
    try:
        # Get all token accounts owned by the wallet
        response = await agent.connection.get_token_accounts_by_owner(
            agent.wallet_address,
            {'programId': PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")}
        )
        
        balances = {}
        for account in response.value:
            token_balance = await agent.connection.get_token_account_balance(
                account.pubkey
            )
            if token_balance.value.ui_amount > 0:
                balances[str(account.account.mint)] = token_balance.value.ui_amount
                
        return balances
    except Exception as error:
        raise Exception(f"Failed to get all token balances: {str(error)}") from error

class BalanceMonitor:
    """Helper class for monitoring balances over time."""
    
    def __init__(self, agent: 'SolanaAgentKit'):
        self.agent = agent
        self.previous_balances = {}
        
    async def update_and_get_changes(
        self,
        token_address: Optional[PublicKey] = None
    ) -> dict:
        """
        Update balances and get changes since last check.
        
        Args:
            token_address: Optional specific token to monitor
            
        Returns:
            Dictionary containing current balance and change
        """
        current_balance = await get_balance(self.agent, token_address)
        token_key = str(token_address) if token_address else 'SOL'
        
        previous = self.previous_balances.get(token_key, 0)
        change = current_balance - previous if current_balance is not None else 0
        
        self.previous_balances[token_key] = current_balance or 0
        
        return {
            'current_balance': current_balance,
            'previous_balance': previous,
            'change': change
        }