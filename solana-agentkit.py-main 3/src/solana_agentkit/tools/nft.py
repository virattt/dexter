# src/solana_agentkit/constants/nft.py

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Final
from enum import Enum

from rsa import PublicKey

class NFTStandard(Enum):
    """NFT token standard types."""
    METAPLEX = "metaplex"
    SPL = "spl"
    SHADOW = "shadow"

class NFTFileType(Enum):
    """NFT file/media types."""
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"
    HTML = "html"
    MODEL = "model"

@dataclass(frozen=True)
class MetaplexPrograms:
    """Metaplex program addresses."""
    TOKEN_METADATA: Final[PublicKey] = PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s")
    CANDY_MACHINE: Final[PublicKey] = PublicKey("cndy3Z4yapfJBmL3ShUp5exZKqR3z33thTzeNMm2gRZ")
    AUCTION_HOUSE: Final[PublicKey] = PublicKey("hausS13jsjafwWwGqZTUQRmWyvyxn9EQpqMwV1PBBmk")

@dataclass
class NFTMetadata:
    """Standard NFT metadata structure."""
    name: str
    symbol: str
    description: str
    seller_fee_basis_points: int = 0
    image: Optional[str] = None
    animation_url: Optional[str] = None
    external_url: Optional[str] = None
    attributes: List[Dict[str, str]] = field(default_factory=list)
    properties: Dict[str, any] = field(default_factory=dict)
    collection: Optional[Dict[str, str]] = None
    creators: List[Dict[str, any]] = field(default_factory=list)

@dataclass
class CollectionConfig:
    """Configuration for NFT collections."""
    name: str
    symbol: str
    description: str
    seller_fee_basis_points: int = 500  # Default 5%
    max_supply: Optional[int] = None
    is_mutable: bool = True
    retain_authority: bool = True
    creators: List[Dict[str, any]] = field(default_factory=list)

class NFTUtils:
    """Utility functions for NFT operations."""
    
    @staticmethod
    def derive_metadata_account(mint: PublicKey) -> PublicKey:
        """
        Derive the metadata account address for a mint.
        
        Args:
            mint: NFT mint address
            
        Returns:
            Metadata account public key
        """
        return PublicKey.find_program_address(
            [
                b"metadata",
                bytes(MetaplexPrograms.TOKEN_METADATA),
                bytes(mint)
            ],
            MetaplexPrograms.TOKEN_METADATA
        )[0]
    
    @staticmethod
    def derive_master_edition(mint: PublicKey) -> PublicKey:
        """
        Derive the master edition address for a mint.
        
        Args:
            mint: NFT mint address
            
        Returns:
            Master edition public key
        """
        return PublicKey.find_program_address(
            [
                b"metadata",
                bytes(MetaplexPrograms.TOKEN_METADATA),
                bytes(mint),
                b"edition"
            ],
            MetaplexPrograms.TOKEN_METADATA
        )[0]
    
    @staticmethod
    def validate_metadata(metadata: NFTMetadata) -> bool:
        """
        Validate NFT metadata structure.
        
        Args:
            metadata: NFT metadata to validate
            
        Returns:
            True if valid, raises ValueError if invalid
        """
        if not metadata.name or len(metadata.name) > 32:
            raise ValueError("Name is required and must be <= 32 chars")
            
        if not metadata.symbol or len(metadata.symbol) > 10:
            raise ValueError("Symbol is required and must be <= 10 chars")
            
        if metadata.seller_fee_basis_points > 10000:
            raise ValueError("Seller fee basis points must be <= 10000")
            
        if metadata.creators:
            total_shares = sum(creator.get('share', 0) for creator in metadata.creators)
            if total_shares != 100:
                raise ValueError("Creator shares must sum to 100")
                
        return True
    
    @staticmethod
    def format_metadata_json(metadata: NFTMetadata) -> Dict:
        """
        Format metadata for JSON storage.
        
        Args:
            metadata: NFT metadata
            
        Returns:
            Formatted metadata dictionary
        """
        return {
            "name": metadata.name,
            "symbol": metadata.symbol,
            "description": metadata.description,
            "seller_fee_basis_points": metadata.seller_fee_basis_points,
            "image": metadata.image,
            "animation_url": metadata.animation_url,
            "external_url": metadata.external_url,
            "attributes": metadata.attributes,
            "properties": {
                **metadata.properties,
                "creators": metadata.creators,
                "files": [
                    {
                        "uri": metadata.image,
                        "type": "image/png"
                    } if metadata.image else None,
                    {
                        "uri": metadata.animation_url,
                        "type": "video/mp4"
                    } if metadata.animation_url else None
                ]
            },
            "collection": metadata.collection
        }

PROGRAMS = MetaplexPrograms()

def create_nft_metadata(
    name: str,
    symbol: str,
    description: str,
    image: Optional[str] = None,
    **kwargs
) -> NFTMetadata:
    """
    Create NFT metadata with validation.
    
    Args:
        name: NFT name
        symbol: NFT symbol
        description: NFT description
        image: Optional image URL
        **kwargs: Additional metadata fields
        
    Returns:
        Validated NFTMetadata instance
    """
    metadata = NFTMetadata(
        name=name,
        symbol=symbol,
        description=description,
        image=image,
        **kwargs
    )
    
    NFTUtils.validate_metadata(metadata)
    return metadata