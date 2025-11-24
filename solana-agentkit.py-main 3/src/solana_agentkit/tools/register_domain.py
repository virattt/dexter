# src/solana_agentkit/tools/register_domain.py

from typing import List, Optional
from dataclasses import dataclass
from httpx import Client
from rsa import PublicKey
from solana.transaction import Transaction
from solana.rpc.commitment import Confirmed

from spl.token.constants import TOKEN_PROGRAM_ID

from solana_agentkit.agent.solana_agent import SolanaAgent
from solana_agentkit.types.account import CreateAccountParams, create_account
from ..constants import TOKENS
import hashlib
import base58

# Bonfida Name Service Program ID
BONFIDA_PROGRAM_ID = PublicKey("jCebN34bUfdeUYJT13J1yG16XWQpt5PDx6Mse9GUqhR")
NAME_PROGRAM_ID = PublicKey("namesLPneVptA9Z5rqUDD9tMTWEJwofgaYwp8cawRkX")

@dataclass
class DomainRegistrationResult:
    """Result of a domain registration operation."""
    signature: str
    domain_key: PublicKey
    registry_key: PublicKey

def derive_domain_address(name: str) -> PublicKey:
    """
    Derive the domain address for a given name.
    
    Args:
        name: Domain name without .sol
        
    Returns:
        PublicKey for the domain
    """
    # Hash the name
    name_hash = hashlib.sha256(f"{name}.sol".encode()).digest()
    
    # Find program address
    return PublicKey.find_program_address(
        [b"domain", name_hash],
        NAME_PROGRAM_ID
    )[0]

def derive_registry_key(domain_key: PublicKey) -> PublicKey:
    """
    Derive the registry key for a domain.
    
    Args:
        domain_key: Domain public key
        
    Returns:
        PublicKey for the registry
    """
    return PublicKey.find_program_address(
        [b"registry", bytes(domain_key)],
        NAME_PROGRAM_ID
    )[0]

async def register_domain(
    agent: 'SolanaAgent',
    name: str,
    space_kb: int = 1
) -> DomainRegistrationResult:
    """
    Register a .sol domain name using Bonfida Name Service.
    
    Args:
        agent: SolanaAgentKit instance
        name: Domain name to register (without .sol)
        space_kb: Space allocation in KB (max 10KB)
        
    Returns:
        DomainRegistrationResult containing transaction signature and domain addresses
        
    Raises:
        Exception: If domain registration fails
    """
    try:
        # Validate space size
        if space_kb > 10:
            raise ValueError("Maximum domain size is 10KB")
            
        # Convert KB to bytes
        space = space_kb * 1_000
        
        # Get buyer's USDC token account
        buyer_token_account = PublicKey.find_program_address(
            [
                bytes(agent.wallet_address),
                bytes(TOKEN_PROGRAM_ID),
                bytes(TOKENS.USDC)
            ],
            PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
        )[0]
        
        # Derive domain and registry addresses
        domain_key = derive_domain_address(name)
        registry_key = derive_registry_key(domain_key)
        
        # Calculate registration cost
        registration_cost = await calculate_registration_cost(
            agent.connection,
            len(name),
            space
        )
        
        # Create transaction
        tx = Transaction()
        
        # Create domain account
        create_domain_ix = create_account(
            CreateAccountParams(
                from_pubkey=agent.wallet_address,
                to_pubkey=domain_key,
                lamports=registration_cost,
                space=space,
                program_id=NAME_PROGRAM_ID
            )
        )
        tx.add(create_domain_ix)
        
        # Add registration instruction
        register_ix = make_register_domain_instruction(
            name=name,
            space=space,
            buyer=agent.wallet_address,
            domain_key=domain_key,
            registry_key=registry_key,
            buyer_token_account=buyer_token_account
        )
        tx.add(register_ix)
        
        # Send transaction
        result = await agent.connection.send_transaction(
            tx,
            [agent.wallet],
            opts={
                "skip_preflight": False,
                "preflight_commitment": Confirmed,
                "max_retries": 3
            }
        )
        
        # Wait for confirmation
        await agent.connection.confirm_transaction(
            result.value.signature,
            commitment=Confirmed
        )
        
        return DomainRegistrationResult(
            signature=base58.b58encode(result.value.signature).decode('ascii'),
            domain_key=domain_key,
            registry_key=registry_key
        )
        
    except Exception as error:
        raise Exception(f"Domain registration failed: {str(error)}") from error

async def calculate_registration_cost(
    connection: 'Client',
    name_length: int,
    space: int
) -> int:
    """Calculate the cost of registering a domain."""
    # Base cost calculation (this is an example - actual calculation would depend on Bonfida's pricing)
    base_cost = 1_000_000  # 0.001 SOL
    length_cost = name_length * 100_000  # 0.0001 SOL per character
    space_cost = space * 1_000  # 0.000001 SOL per byte
    
    rent_exemption = await connection.get_minimum_balance_for_rent_exemption(space)
    
    return base_cost + length_cost + space_cost + rent_exemption

def make_register_domain_instruction(
    name: str,
    space: int,
    buyer: PublicKey,
    domain_key: PublicKey,
    registry_key: PublicKey,
    buyer_token_account: PublicKey
):
    """Create the instruction for registering a domain."""
    # Note: This is a simplified version - actual instruction would need to match
    # Bonfida's instruction layout
    keys = [
        {"pubkey": buyer, "is_signer": True, "is_writable": True},
        {"pubkey": domain_key, "is_signer": False, "is_writable": True},
        {"pubkey": registry_key, "is_signer": False, "is_writable": True},
        {"pubkey": buyer_token_account, "is_signer": False, "is_writable": True},
        {"pubkey": TOKEN_PROGRAM_ID, "is_signer": False, "is_writable": False},
    ]
    
    data = bytes([0])  # Instruction discriminator
    data += len(name).to_bytes(4, 'little')
    data += name.encode()
    data += space.to_bytes(8, 'little')
    
    return type(
        'Instruction',
        (),
        {
            'keys': keys,
            'program_id': NAME_PROGRAM_ID,
            'data': data
        }
    )

class DomainRegistrar:
    """Helper class for domain registration operations."""
    
    def __init__(self, agent: 'SolanaAgent'):
        self.agent = agent
        
    async def register(
        self,
        name: str,
        space_kb: int = 1
    ) -> DomainRegistrationResult:
        """Register a new .sol domain."""
        return await register_domain(self.agent, name, space_kb)
        
    async def check_availability(self, name: str) -> bool:
        """Check if a domain name is available."""
        try:
            domain_key = derive_domain_address(name)
            info = await self.agent.connection.get_account_info(domain_key)
            return info.value is None
        except Exception:
            return False