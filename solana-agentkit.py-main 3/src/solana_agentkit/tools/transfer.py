# src/solana_agentkit/tools/transfer.py

from typing import Optional, Dict, Any
from dataclasses import dataclass
from rsa import PublicKey
from solana.transaction import Transaction
from solana.rpc.commitment import Confirmed

from spl.token.constants import TOKEN_PROGRAM_ID, LAMPORTS_PER_SOL
from spl.token.instructions import get_associated_token_account, transfer as spl_transfer
import logging

from solana_agentkit.agent.solana_agent import SolanaAgent
from solana_agentkit.types.account import TransferParams, transfer

logger = logging.getLogger(__name__)

@dataclass
class TransferResult:
    """Result of a transfer operation."""
    signature: str
    from_address: str
    to_address: str
    amount: float
    token: Optional[str] = None

async def get_token_mint_info(
    agent: 'SolanaAgent',
    mint: PublicKey
) -> Dict[str, Any]:
    """
    Get information about a token mint.
    
    Args:
        agent: SolanaAgentKit instance
        mint: Token mint address
        
    Returns:
        Dictionary containing mint information
    """
    try:
        mint_info = await agent.connection.get_account_info(mint)
        if not mint_info.value:
            raise Exception(f"Mint {mint} not found")
            
        return {
            "address": mint,
            "decimals": mint_info.value.data[4],  # Decimal precision is stored at offset 4
            "authority": PublicKey(mint_info.value.data[5:37])  # Mint authority
        }
    except Exception as error:
        raise Exception(f"Failed to get mint info: {str(error)}") from error

async def transfer_tokens(
    agent: 'SolanaAgent',
    to: PublicKey,
    amount: float,
    mint: Optional[PublicKey] = None
) -> TransferResult:
    """
    Transfer SOL or SPL tokens to a recipient.
    
    Args:
        agent: SolanaAgentKit instance
        to: Recipient's public key
        amount: Amount to transfer
        mint: Optional mint address for SPL tokens
        
    Returns:
        TransferResult containing transaction details
        
    Raises:
        Exception: If transfer fails
    """
    try:
        if not mint:
            # Transfer native SOL
            logger.info(f"Transferring {amount} SOL to {to}")
            
            # Create transfer instruction
            transfer_ix = transfer(
                TransferParams(
                    from_pubkey=agent.wallet_address,
                    to_pubkey=to,
                    lamports=int(amount * LAMPORTS_PER_SOL)
                )
            )
            
            # Create and send transaction
            tx = Transaction().add(transfer_ix)
            
            result = await agent.connection.send_transaction(
                tx,
                [agent.wallet],
                opts={
                    "skip_preflight": False,
                    "preflight_commitment": Confirmed,
                    "max_retries": 3
                }
            )
            
            signature = result.value.signature
            
        else:
            # Transfer SPL token
            logger.info(f"Transferring {amount} tokens from mint {mint} to {to}")
            
            # Get token accounts
            from_ata = await get_associated_token_account(
                mint,
                agent.wallet_address
            )
            
            to_ata = await get_associated_token_account(
                mint,
                to
            )
            
            # Get mint info for decimals
            mint_info = await get_token_mint_info(agent, mint)
            adjusted_amount = int(amount * (10 ** mint_info['decimals']))
            
            # Create transfer instruction
            transfer_ix = spl_transfer(
                TOKEN_PROGRAM_ID,
                from_ata,
                to_ata,
                agent.wallet_address,
                [],
                adjusted_amount
            )
            
            # Create and send transaction
            tx = Transaction().add(transfer_ix)
            
            result = await agent.connection.send_transaction(
                tx,
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
        
        return TransferResult(
            signature=str(signature),
            from_address=str(agent.wallet_address),
            to_address=str(to),
            amount=amount,
            token=str(mint) if mint else "SOL"
        )
        
    except Exception as error:
        raise Exception(f"Transfer failed: {str(error)}") from error

class TokenTransferManager:
    """Helper class for managing token transfers."""
    
    def __init__(self, agent: 'SolanaAgent'):
        self.agent = agent
        self._transfer_history: list[TransferResult] = []
        
    async def send(
        self,
        to: PublicKey,
        amount: float,
        mint: Optional[PublicKey] = None
    ) -> TransferResult:
        """Execute a token transfer."""
        result = await transfer_tokens(self.agent, to, amount, mint)
        self._transfer_history.append(result)
        return result
        
    async def verify_transfer(
        self,
        result: TransferResult
    ) -> bool:
        """Verify a transfer was successful."""
        try:
            tx_info = await self.agent.connection.get_transaction(
                result.signature,
                commitment=Confirmed
            )
            return tx_info.value.meta.err is None
        except Exception:
            return False
            
    def get_transfer_history(self) -> list[TransferResult]:
        """Get list of all transfers made."""
        return self._transfer_history.copy()