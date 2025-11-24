# src/solana_agentkit/utils/keypair.py

from typing import Optional, Union
from dataclasses import dataclass
from rsa import PublicKey, keypair
import base58
import json
import os
from pathlib import Path
import logging

from tests.test_agent import keypair
import base58
from solders.keypair import Keypair  # type: ignore
from solders.pubkey import Pubkey  # type: ignore

keypair = Keypair()

public_key = keypair.pubkey()
print("Public Key:", public_key)

secret_key = keypair.secret()
secret_key_base58 = base58.b58encode(secret_key)
print("Secret Key(Base58):", secret_key_base58.decode("utf-8"))
logger = logging.getLogger(__name__)

@dataclass
class KeypairInfo:
    """Information about a keypair."""
    public_key: str
    secret_key: str
    path: Optional[str] = None

def generate_keypair() -> Keypair:
    """
    Generate a new random keypair.
    
    Returns:
        New Keypair instance
    """
    return keypair()

def keypair_from_seed(seed: Union[str, bytes]) -> Keypair:
    """
    Create a keypair from a seed.
    
    Args:
        seed: Seed string or bytes
        
    Returns:
        Keypair derived from seed
    """
    if isinstance(seed, str):
        seed = seed.encode()
    
    # Ensure seed is 32 bytes
    if len(seed) > 32:
        seed = seed[:32]
    elif len(seed) < 32:
        seed = seed.ljust(32, b'\0')
        
    return keypair.from_seed(seed)

def load_keypair(path: Union[str, Path]) -> Keypair:
    """
    Load a keypair from a file.
    
    Args:
        path: Path to keypair file
        
    Returns:
        Loaded Keypair
        
    Raises:
        Exception: If file cannot be loaded
    """
    try:
        path = Path(path)
        if not path.exists():
            raise FileNotFoundError(f"Keypair file not found: {path}")
            
        with open(path, 'r') as f:
            data = json.load(f)
            
        if isinstance(data, list):
            # Array format
            return keypair.from_secret_key(bytes(data))
        elif isinstance(data, dict):
            # JSON format with public/private keys
            if 'private' in data:
                private_key = base58.b58decode(data['private'])
                return keypair.from_secret_key(private_key)
                
        raise ValueError("Invalid keypair file format")
        
    except Exception as error:
        logger.error(f"Failed to load keypair: {error}")
        raise

def save_keypair(
    keypair: Keypair,
    path: Union[str, Path],
    format: str = 'json'
) -> None:
    """
    Save a keypair to a file.
    
    Args:
        keypair: Keypair to save
        path: Path to save to
        format: Format to save in ('json' or 'array')
    """
    try:
        path = Path(path)
        os.makedirs(path.parent, exist_ok=True)
        
        if format == 'json':
            data = {
                'public': str(keypair.public_key),
                'private': base58.b58encode(keypair.secret_key).decode('ascii')
            }
            with open(path, 'w') as f:
                json.dump(data, f, indent=2)
        elif format == 'array':
            with open(path, 'w') as f:
                json.dump([int(b) for b in keypair.secret_key], f)
        else:
            raise ValueError(f"Unsupported format: {format}")
            
    except Exception as error:
        logger.error(f"Failed to save keypair: {error}")
        raise

def create_deterministic_keypair(
    base_keypair: Keypair,
    index: int
) -> Keypair:
    """
    Create a deterministic keypair from a base keypair and index.
    
    Args:
        base_keypair: Base keypair to derive from
        index: Index for derivation
        
    Returns:
        Derived keypair
    """
    seed = bytes(base_keypair.secret_key) + index.to_bytes(4, 'little')
    return keypair_from_seed(seed)

class KeypairManager:
    """Helper class for managing multiple keypairs."""
    
    def __init__(self, base_path: Optional[Union[str, Path]] = None):
        self.base_path = Path(base_path) if base_path else Path.home() / '.solana' / 'keypairs'
        self.keypairs: dict[str, KeypairInfo] = {}
        
    def add_keypair(
        self,
        name: str,
        keypair: Union[Keypair, str, Path],
        save: bool = True
    ) -> KeypairInfo:
        """Add a keypair to the manager."""
        if isinstance(keypair, (str, Path)):
            keypair = load_keypair(keypair)
            
        info = KeypairInfo(
            public_key=str(keypair.public_key),
            secret_key=base58.b58encode(keypair.secret_key).decode('ascii'),
            path=str(self.base_path / f"{name}.json") if save else None
        )
        
        if save:
            save_keypair(keypair, info.path)
            
        self.keypairs[name] = info
        return info
        
    def get_keypair(self, name: str) -> Optional[Keypair]:
        """Get a keypair by name."""
        info = self.keypairs.get(name)
        if info:
            return keypair.from_secret_key(
                base58.b58decode(info.secret_key)
            )
        return None
        
    def list_keypairs(self) -> list[str]:
        """List all managed keypair names."""
        return list(self.keypairs.keys())
        
    def remove_keypair(self, name: str) -> None:
        """Remove a keypair from management."""
        info = self.keypairs.pop(name, None)
        if info and info.path:
            try:
                os.remove(info.path)
            except OSError:
                pass

class KeypairDerivation:
    """Utility class for keypair derivation patterns."""
    
    @staticmethod
    def from_phrase(phrase: str, salt: Optional[str] = None) -> Keypair:
        """Create keypair from a phrase."""
        seed = phrase.encode()
        if salt:
            seed = seed + salt.encode()
        return keypair_from_seed(seed)
    
    @staticmethod
    def create_hierarchical(
        master: Keypair,
        path: list[int]
    ) -> Keypair:
        """Create hierarchical deterministic keypair."""
        current = master
        for index in path:
            current = create_deterministic_keypair(current, index)
        return current