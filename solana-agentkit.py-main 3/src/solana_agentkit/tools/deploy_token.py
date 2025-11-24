# src/solana_agentkit/tools/deploy_token.py

from typing import Dict, Any
from dataclasses import dataclass
from rsa import PublicKey
#from solana.system_program import CreateAccountParams, create_account
from solana.transaction import Transaction
from solana.rpc.commitment import Confirmed
from solana_agentkit.agent import SolanaAgentKit
from spl.token.constants import TOKEN_PROGRAM_ID, MINT_SIZE
from spl.token.instructions import initialize_mint
import logging

from solana_agentkit.types.account import CreateAccountParams, create_account
from solana_agentkit.utils import keypair

logger = logging.getLogger(__name__)

@dataclass
class TokenDeploymentResult:
    """Result of a token deployment operation."""
    mint: PublicKey
    transaction_signature: str

async def deploy_token(
    agent: 'SolanaAgentKit',
    decimals: int = 9
) -> TokenDeploymentResult:
    """
    Deploy a new SPL token on Solana.
    
    Args:
        agent: Instance of SolanaAgentKit
        decimals: Number of decimal places for the token (default: 9)
        
    Returns:
        TokenDeploymentResult containing mint address and transaction signature
        
    Raises:
        Exception: If token deployment fails
    """
    try:
        # Generate new mint keypair
        mint = keypair()
        logger.info(f"Mint address: {mint.public_key}")
        logger.info(f"Agent address: {agent.wallet_address}")

        # Calculate minimum rent exemption
        lamports = await agent.connection.get_minimum_balance_for_rent_exemption(MINT_SIZE)

        # Create transaction
        tx = Transaction()

        # Create account instruction
        create_account_ix = create_account(
            CreateAccountParams(
                from_pubkey=agent.wallet_address,
                to_pubkey=mint.public_key,
                lamports=lamports,
                space=MINT_SIZE,
                program_id=TOKEN_PROGRAM_ID
            )
        )
        tx.add(create_account_ix)

        # Initialize mint instruction
        init_mint_ix = initialize_mint(
            program_id=TOKEN_PROGRAM_ID,
            mint=mint.public_key,
            mint_authority=agent.wallet_address,
            freeze_authority=agent.wallet_address,  # Optional, can be None
            decimals=decimals
        )
        tx.add(init_mint_ix)

        # Sign and send transaction
        transaction_bytes = tx.serialize(
            verify_signers=False,  # Don't verify signers here since we'll sign with all required keys
        )
        
        signers = [agent.wallet, mint]
        
        # Send transaction
        result = await agent.connection.send_transaction(
            tx,
            signers,
            opts={"preflight_commitment": Confirmed}
        )

        if "error" in result:
            raise Exception(result["error"])

        signature = result.value.signature.decode('ascii')
        logger.info(f"Transaction signature: {signature}")
        logger.info(f"Token deployed successfully. Mint address: {mint.public_key}")

        return TokenDeploymentResult(
            mint=mint.public_key,
            transaction_signature=signature
        )

    except Exception as error:
        logger.error(f"Error deploying token: {str(error)}")
        raise Exception(f"Token deployment failed: {str(error)}") from error

def validate_token_params(decimals: int) -> None:
    """
    Validate token deployment parameters.
    
    Args:
        decimals: Number of decimal places for the token
        
    Raises:
        ValueError: If parameters are invalid
    """
    if not isinstance(decimals, int):
        raise ValueError("Decimals must be an integer")
        
    if not 0 <= decimals <= 9:
        raise ValueError("Decimals must be between 0 and 9")

class TokenDeploymentBuilder:
    """Helper class for building token deployments with custom configurations."""
    
    def __init__(self, agent: 'SolanaAgentKit'):
        self.agent = agent
        self.decimals = 9
        self.has_freeze_authority = True
        
    def set_decimals(self, decimals: int) -> 'TokenDeploymentBuilder':
        """Set the number of decimal places."""
        validate_token_params(decimals)
        self.decimals = decimals
        return self
        
    def disable_freeze_authority(self) -> 'TokenDeploymentBuilder':
        """Disable the freeze authority on the token."""
        self.has_freeze_authority = False
        return self
        
    async def deploy(self) -> TokenDeploymentResult:
        """Execute the token deployment."""
        # Create transaction
        mint = keypair()
        tx = Transaction()
        
        # Add account creation
        lamports = await self.agent.connection.get_minimum_balance_for_rent_exemption(MINT_SIZE)
        create_account_ix = create_account(
            CreateAccountParams(
                from_pubkey=self.agent.wallet_address,
                to_pubkey=mint.public_key,
                lamports=lamports,
                space=MINT_SIZE,
                program_id=TOKEN_PROGRAM_ID
            )
        )
        tx.add(create_account_ix)
        
        # Add mint initialization
        freeze_authority = self.agent.wallet_address if self.has_freeze_authority else None
        init_mint_ix = initialize_mint(
            program_id=TOKEN_PROGRAM_ID,
            mint=mint.public_key,
            mint_authority=self.agent.wallet_address,
            freeze_authority=freeze_authority,
            decimals=self.decimals
        )
        tx.add(init_mint_ix)
        
        # Send transaction
        result = await self.agent.connection.send_transaction(
            tx,
            [self.agent.wallet, mint],
            opts={"preflight_commitment": Confirmed}
        )
        
        return TokenDeploymentResult(
            mint=mint.public_key,
            transaction_signature=result.value.signature.decode('ascii')
        )