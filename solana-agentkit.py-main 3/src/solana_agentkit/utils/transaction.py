from typing import Dict, List, Optional, Union, Any
from dataclasses import dataclass
from httpx import AsyncClient
from solana.transaction import Transaction, TransactionInstruction
from rsa import PublicKey, Keypair
from solana.rpc.commitment import Confirmed
from solana.rpc.types import TxOpts
import base58
import logging

logger = logging.getLogger(__name__)

@dataclass
class TransactionConfig:
    """Configuration for transaction execution."""
    skip_preflight: bool = False
    preflight_commitment: str = Confirmed
    max_retries: int = 3
    compute_unit_price: Optional[int] = None
    compute_unit_limit: Optional[int] = None

@dataclass
class TransactionResponse:
    """Response from a transaction execution."""
    signature: str
    blockhash: str
    slot: int
    error: Optional[str] = None
    logs: Optional[List[str]] = None

async def process_transaction(
    connection: 'AsyncClient',
    transaction: Transaction,
    signers: List[Keypair],
    config: Optional[TransactionConfig] = None
) -> TransactionResponse:
    """
    Process and send a transaction with proper error handling.
    
    Args:
        connection: Solana RPC connection
        transaction: Transaction to send
        signers: List of signers
        config: Optional transaction configuration
        
    Returns:
        TransactionResponse with result details
        
    Raises:
        Exception: If transaction processing fails
    """
    try:
        config = config or TransactionConfig()
        
        # Get recent blockhash
        recent_blockhash = await connection.get_latest_blockhash()
        transaction.recent_blockhash = recent_blockhash.value.blockhash
        
        # Add compute budget instructions if needed
        if config.compute_unit_price or config.compute_unit_limit:
            budget_ix = create_compute_budget_ix(
                unit_price=config.compute_unit_price,
                unit_limit=config.compute_unit_limit
            )
            transaction.add(budget_ix)
        
        # Sign transaction
        for signer in signers:
            transaction.sign(signer)
        
        # Send transaction
        result = await connection.send_transaction(
            transaction,
            *signers,
            opts=TxOpts(
                skip_preflight=config.skip_preflight,
                preflight_commitment=config.preflight_commitment,
                max_retries=config.max_retries
            )
        )
        
        # Confirm transaction
        confirmation = await connection.confirm_transaction(
            result.value.signature,
            commitment=config.preflight_commitment
        )
        
        # Get transaction details
        tx_details = await connection.get_transaction(
            result.value.signature,
            commitment=config.preflight_commitment
        )
        
        return TransactionResponse(
            signature=base58.b58encode(result.value.signature).decode('ascii'),
            blockhash=recent_blockhash.value.blockhash,
            slot=tx_details.slot if tx_details else 0,
            error=confirmation.value.err,
            logs=tx_details.value.transaction.meta.log_messages if tx_details else None
        )
        
    except Exception as error:
        logger.error(f"Transaction processing failed: {error}")
        raise

def create_compute_budget_ix(
    unit_price: Optional[int] = None,
    unit_limit: Optional[int] = None
) -> TransactionInstruction:
    """
    Create compute budget instruction.
    
    Args:
        unit_price: Optional compute unit price
        unit_limit: Optional compute unit limit
        
    Returns:
        TransactionInstruction for compute budget
    """
    if unit_price:
        return TransactionInstruction(
            program_id=PublicKey("ComputeBudget111111111111111111111111111111"),
            keys=[],
            data=bytes([2]) + unit_price.to_bytes(8, 'little')
        )
    elif unit_limit:
        return TransactionInstruction(
            program_id=PublicKey("ComputeBudget111111111111111111111111111111"),
            keys=[],
            data=bytes([0]) + unit_limit.to_bytes(4, 'little')
        )
    else:
        raise ValueError("Either unit_price or unit_limit must be provided")

class TransactionBundler:
    """Helper class for bundling multiple transactions."""
    
    def __init__(self, connection: 'AsyncClient'):
        self.connection = connection
        self.transactions: List[Transaction] = []
        self.signers: List[List[Keypair]] = []
        
    def add_transaction(
        self,
        transaction: Transaction,
        signers: List[Keypair]
    ) -> None:
        """Add a transaction to the bundle."""
        self.transactions.append(transaction)
        self.signers.append(signers)
        
    async def process_all(
        self,
        config: Optional[TransactionConfig] = None
    ) -> List[TransactionResponse]:
        """Process all transactions in the bundle."""
        responses = []
        for tx, signers in zip(self.transactions, self.signers):
            try:
                response = await process_transaction(
                    self.connection,
                    tx,
                    signers,
                    config
                )
                responses.append(response)
            except Exception as error:
                logger.error(f"Bundle transaction failed: {error}")
                responses.append(TransactionResponse(
                    signature="",
                    blockhash="",
                    slot=0,
                    error=str(error)
                ))
        return responses

class TransactionInstructionBuilder:
    """Helper class for building transaction instructions."""
    
    def __init__(self, program_id: PublicKey):
        self.program_id = program_id
        self.keys = []
        self.data = bytearray()
        
    def add_account(
        self,
        pubkey: PublicKey,
        is_signer: bool = False,
        is_writable: bool = False
    ) -> 'TransactionInstructionBuilder':
        """Add an account to the instruction."""
        self.keys.append({
            'pubkey': pubkey,
            'is_signer': is_signer,
            'is_writable': is_writable
        })
        return self
        
    def add_data(self, data: bytes) -> 'TransactionInstructionBuilder':
        """Add data to the instruction."""
        self.data.extend(data)
        return self
        
    def build(self) -> TransactionInstruction:
        """Build the transaction instruction."""
        return TransactionInstruction(
            program_id=self.program_id,
            keys=self.keys,
            data=bytes(self.data)
        )