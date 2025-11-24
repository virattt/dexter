# src/solana_agentkit/utils/domains.py

from typing import Optional, Dict, Any
from dataclasses import dataclass
from rsa import PublicKey
from solana.rpc.commitment import Confirmed
import hashlib
import base58
import logging

from solana_agentkit.agent.solana_agent import SolanaAgent

logger = logging.getLogger(__name__)

# Program IDs
BONFIDA_PROGRAM_ID = PublicKey("jCebN34bUfdeUYJT13J1yG16XWQpt5PDx6Mse9GUqhR")
NAME_PROGRAM_ID = PublicKey("namesLPneVptA9Z5rqUDD9tMTWEJwofgaYwp8cawRkX")

@dataclass
class DomainInfo:
    """Information about a Solana domain."""
    name: str
    owner: PublicKey
    space: int
    parent_name: Optional[str] = None
    expiry_date: Optional[int] = None
    class_: Optional[str] = None

@dataclass
class DomainRecord:
    """Record data for a domain."""
    domain: str
    record_type: str
    data: str

def get_hashed_name(name: str) -> bytes:
    """
    Get the hashed version of a domain name.
    
    Args:
        name: Domain name without .sol
        
    Returns:
        Hashed name bytes
    """
    return hashlib.sha256(f"{name}.sol".encode()).digest()

def get_domain_key(name: str) -> PublicKey:
    """
    Get the public key for a domain.
    
    Args:
        name: Domain name without .sol
        
    Returns:
        Domain public key
    """
    hashed_name = get_hashed_name(name)
    return PublicKey.find_program_address(
        [b"domain", hashed_name],
        NAME_PROGRAM_ID
    )[0]

def get_registry_key(domain_key: PublicKey) -> PublicKey:
    """
    Get the registry key for a domain.
    
    Args:
        domain_key: Domain public key
        
    Returns:
        Registry public key
    """
    return PublicKey.find_program_address(
        [b"registry", bytes(domain_key)],
        NAME_PROGRAM_ID
    )[0]

async def get_domain_info(
    agent: 'SolanaAgent',
    name: str
) -> Optional[DomainInfo]:
    """
    Get information about a domain.
    
    Args:
        agent: SolanaAgentKit instance
        name: Domain name without .sol
        
    Returns:
        DomainInfo if domain exists, None otherwise
    """
    try:
        domain_key = get_domain_key(name)
        account_info = await agent.connection.get_account_info(
            domain_key,
            commitment=Confirmed
        )
        
        if not account_info.value:
            return None
            
        data = account_info.value.data
        
        # Parse domain data
        return DomainInfo(
            name=name,
            owner=PublicKey(data[0:32]),
            space=int.from_bytes(data[32:40], 'little'),
            parent_name=data[40:72].decode().strip('\x00') if data[40:72] else None,
            expiry_date=int.from_bytes(data[72:80], 'little'),
            class_=data[80:112].decode().strip('\x00') if data[80:112] else None
        )
        
    except Exception as error:
        logger.error(f"Failed to get domain info: {error}")
        return None

async def get_domain_record(
    agent: 'SolanaAgent',
    name: str,
    record_type: str
) -> Optional[str]:
    """
    Get a record for a domain.
    
    Args:
        agent: SolanaAgentKit instance
        name: Domain name without .sol
        record_type: Type of record to retrieve
        
    Returns:
        Record data if exists, None otherwise
    """
    try:
        domain_key = get_domain_key(name)
        record_key = PublicKey.find_program_address(
            [bytes(domain_key), record_type.encode()],
            NAME_PROGRAM_ID
        )[0]
        
        account_info = await agent.connection.get_account_info(
            record_key,
            commitment=Confirmed
        )
        
        if not account_info.value:
            return None
            
        return account_info.value.data.decode().strip('\x00')
        
    except Exception as error:
        logger.error(f"Failed to get domain record: {error}")
        return None

class DomainManager:
    """Helper class for domain management."""
    
    def __init__(self, agent: 'SolanaAgent'):
        self.agent = agent
        
    async def resolve_domain(self, name: str) -> Optional[PublicKey]:
        """Resolve a .sol domain to its owner's address."""
        info = await get_domain_info(self.agent, name)
        return info.owner if info else None
        
    async def reverse_lookup(self, address: PublicKey) -> list[str]:
        """Find all domains owned by an address."""
        try:
            domains = []
            # This is a simplified implementation
            # In practice, you'd need to implement proper filtering
            # based on the Bonfida program's data structure
            return domains
        except Exception as error:
            logger.error(f"Failed reverse lookup: {error}")
            return []
            
    async def check_availability(self, name: str) -> bool:
        """Check if a domain name is available."""
        info = await get_domain_info(self.agent, name)
        return info is None
        
    async def get_all_records(self, name: str) -> Dict[str, str]:
        """Get all records for a domain."""
        record_types = ['A', 'AAAA', 'TXT', 'CNAME', 'IPFS']
        records = {}
        
        for record_type in record_types:
            if data := await get_domain_record(self.agent, name, record_type):
                records[record_type] = data
                
        return records
        
    def validate_domain_name(self, name: str) -> bool:
        """
        Validate a domain name.
        
        Args:
            name: Domain name without .sol
            
        Returns:
            True if valid, False otherwise
        """
        if not name:
            return False
            
        if len(name) > 64:
            return False
            
        allowed = set("abcdefghijklmnopqrstuvwxyz0123456789-")
        if not set(name.lower()).issubset(allowed):
            return False
            
        if name.startswith('-') or name.endswith('-'):
            return False
            
        return True