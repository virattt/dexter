# src/solana_agentkit/utils/send_tx.py

from typing import Dict, Optional, NamedTuple, List, Any
from dataclasses import dataclass
from httpx import AsyncClient
from rsa import PublicKey, Keypair
from solana.transaction import Transaction
from solana.rpc.commitment import Confirmed
from solana.rpc.types import TxOpts
import statistics
import logging

from solana_agentkit.agent.solana_agent import SolanaAgent

logger = logging.getLogger(__name__)

@dataclass
class PriorityFeeLevels:
    """Priority fee levels for transactions."""
    low: int
    medium: int
    high: int

class PriorityFeeInfo(NamedTuple):
    """Information about priority fees."""
    min: int
    median: int
    max: int
    instructions: Optional[PriorityFeeLevels] = None

async def get_priority_fees(
    connection: 'AsyncClient'
) -> PriorityFeeInfo:
    """
    Get priority fees for the current block.
    
    Args:
        connection: Solana RPC connection
        
    Returns:
        PriorityFeeInfo containing fee statistics and instructions
        
    Raises:
        Exception: If fee retrieval fails
    """
    try:
        # Get recent priority fees
        priority_fees = await connection.get_recent_prioritization_fees()
        
        if not priority_fees:
            return PriorityFeeInfo(0, 0, 0)
            
        # Extract and sort fees
        fees = sorted(fee.prioritization_fee for fee in priority_fees)
        
        # Calculate statistics
        min_fee = fees[0]
        max_fee = fees[-1]
        
        # Calculate median
        if len(fees) % 2 == 0:
            median_fee = statistics.median(fees)
        else:
            mid = len(fees) // 2
            median_fee = fees[mid]
        
        # Create instructions for different fee levels
        instructions = PriorityFeeLevels(
            low=min_fee,
            medium=median_fee,
            high=max_fee
        )
        
        return PriorityFeeInfo(
            min=min_fee,
            median=median_fee,
            max=max_fee,
            instructions=instructions
        )
        
    except Exception as error:
        logger.error(f"Error getting priority fees: {error}")
        raise

async def create_compute_budget_ix(
    micro_lamports: int
) -> Any:  # Return type depends on Solana SDK
    """Create compute budget instruction for priority fee."""
    # Note: This is a placeholder - actual implementation would depend on
    # the Solana Python SDK's compute budget program implementation
    return {
        'program_id': PublicKey("ComputeBudget111111111111111111111111111111"),
        'keys': [],
        'data': bytes([2]) + micro_lamports.to_bytes(8, 'little')
    }

async def send_tx(
    agent: 'SolanaAgent',
    tx: Transaction,
    other_keypairs: Optional[List[Keypair]] = None,
    priority_level: str = 'medium',
    opts: Optional[TxOpts] = None
) -> str:
    """
    Send a transaction with priority fees.
    
    Args:
        agent: SolanaAgentKit instance
        tx: Transaction to send
        other_keypairs: Optional additional signers
        priority_level: Priority fee level (low, medium, high)
        opts: Optional transaction options
        
    Returns:
        Transaction signature
        
    Raises:
        Exception: If transaction fails
    """
    try:
        # Get recent blockhash
        recent_blockhash = await agent.connection.get_latest_blockhash()
        tx.recent_blockhash = recent_blockhash.value.blockhash
        
        # Set fee payer
        tx.fee_payer = agent.wallet_address
        
        # Get and add priority fees
        fees = await get_priority_fees(agent.connection)
        if fees.instructions:
            fee_level = getattr(fees.instructions, priority_level)
            budget_ix = await create_compute_budget_ix(fee_level)
            tx.add(budget_ix)
        
        # Sign transaction
        signers = [agent.wallet]
        if other_keypairs:
            signers.extend(other_keypairs)
        
        tx.sign(*signers)
        
        # Send transaction
        opts = opts or TxOpts(
            skip_preflight=False,
            preflight_commitment=Confirmed,
            max_retries=3
        )
        
        result = await agent.connection.send_transaction(
            tx,
            *signers,
            opts=opts
        )
        
        # Confirm transaction
        confirmation = await agent.connection.confirm_transaction(
            result.value.signature,
            commitment=Confirmed
        )
        
        if confirmation.value.err:
            raise Exception(f"Transaction failed: {confirmation.value.err}")
            
        return str(result.value.signature)
        
    except Exception as error:
        logger.error(f"Error sending transaction: {error}")
        raise

class TransactionBuilder:
    """Helper class for building and sending transactions."""
    
    def __init__(self, agent: 'SolanaAgent'):
        self.agent = agent
        self.tx = Transaction()
        self.signers: List[Keypair] = []
        
    def add_instruction(self, instruction: Any) -> 'TransactionBuilder':
        """Add an instruction to the transaction."""
        self.tx.add(instruction)
        return self
        
    def add_signer(self, signer: Keypair) -> 'TransactionBuilder':
        """Add a signer to the transaction."""
        self.signers.append(signer)
        return self
        
    async def send(
        self,
        priority_level: str = 'medium',
        opts: Optional[TxOpts] = None
    ) -> str:
        """Send the built transaction."""
        return await send_tx(
            self.agent,
            self.tx,
            self.signers,
            priority_level,
            opts
        )