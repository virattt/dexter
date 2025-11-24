from typing import Union, Optional, List, Tuple
import base58
import hashlib
import re

class PublicKey:
    """A public key in the Solana ecosystem."""
    
    LENGTH = 32  # Size of public key in bytes
    
    def __init__(self, value: Union[str, bytes, int, List[int]]):
        """
        Initialize a public key.
        
        Args:
            value: Value to create public key from. Can be:
                - Base58 encoded string
                - Byte array
                - List of integers
                - Integer
        """
        if isinstance(value, str):
            # Decode base58 string
            if re.match(r'^[1-9A-HJ-NP-Za-km-z]{32,44}$', value) is None:
                raise ValueError('Invalid base58 value')
            bytes_value = base58.b58decode(value)
            
        elif isinstance(value, bytes):
            bytes_value = value
            
        elif isinstance(value, list):
            bytes_value = bytes(value)
            
        elif isinstance(value, int):
            bytes_value = value.to_bytes(32, byteorder='little')
            
        else:
            raise ValueError('Invalid public key value')
            
        if len(bytes_value) != self.LENGTH:
            raise ValueError(
                f'Invalid public key input length: {len(bytes_value)} (expected {self.LENGTH})'
            )
            
        self._key = bytes_value
    
    @staticmethod
    def default() -> 'PublicKey':
        """Get default public key (all zeros)."""
        return PublicKey(bytes([0] * PublicKey.LENGTH))
    
    @classmethod
    def new_unique(cls) -> 'PublicKey':
        """Generate a new random public key."""
        import os
        return cls(os.urandom(cls.LENGTH))
    
    @classmethod
    def find_program_address(
        cls,
        seeds: List[bytes],
        program_id: 'PublicKey'
    ) -> Tuple['PublicKey', int]:
        """
        Find a program address with bump seed.
        
        Args:
            seeds: List of seeds to derive from
            program_id: Program ID to derive for
            
        Returns:
            Tuple of (PublicKey, bump_seed)
        """
        bump_seed = 255
        while bump_seed > 0:
            try:
                seeds_with_bump = seeds + [bytes([bump_seed])]
                return (
                    cls.create_program_address(seeds_with_bump, program_id),
                    bump_seed
                )
            except ValueError:
                bump_seed -= 1
                
        raise ValueError("Unable to find a viable bump seed")
    
    @classmethod
    def create_program_address(
        cls,
        seeds: List[bytes],
        program_id: 'PublicKey'
    ) -> 'PublicKey':
        """
        Create a program address from seeds.
        
        Args:
            seeds: List of seeds to derive from
            program_id: Program ID to derive for
            
        Returns:
            Derived program address
        """
        buffer = b''.join(seeds)
        buffer += bytes(program_id)
        buffer += b"ProgramDerivedAddress"
        
        hash_result = hashlib.sha256(buffer).digest()
        
        if cls.is_on_curve(hash_result):
            raise ValueError("Invalid seeds, address must not be on curve")
            
        return cls(hash_result)
    
    @staticmethod
    def is_on_curve(bytes_value: bytes) -> bool:
        """
        Check if a point is on ed25519 curve.
        
        Args:
            bytes_value: Point to check
            
        Returns:
            True if point is on curve
        """
        # This is a simplified check - in production you'd want 
        # a proper ed25519 curve check
        return False
    
    def __eq__(self, other: object) -> bool:
        """Check equality with another public key."""
        if not isinstance(other, PublicKey):
            return False
        return self._key == other._key
    
    def __str__(self) -> str:
        """Get string representation (base58 encoded)."""
        return base58.b58encode(self._key).decode('ascii')
        
    def __repr__(self) -> str:
        """Get string representation for debugging."""
        return f"PublicKey({str(self)})"
        
    def __bytes__(self) -> bytes:
        """Get raw bytes."""
        return self._key
        
    def to_base58(self) -> str:
        """Get base58 encoded string."""
        return str(self)
        
    def to_bytes(self) -> bytes:
        """Get raw bytes."""
        return bytes(self)
        
    @property
    def _bin(self) -> str:
        """Get binary string representation."""
        return bin(int.from_bytes(self._key, byteorder='little'))[2:].zfill(8 * self.LENGTH)


