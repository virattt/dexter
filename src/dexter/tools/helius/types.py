"""Type definitions for Helius API responses."""

from typing import Optional, List, Dict, Any, Union
from dataclasses import dataclass
from enum import Enum


class TokenInterface(str, Enum):
    """Solana token standard interface types."""
    V1_NFT = "V1_NFT"
    V1_PRINT = "V1_PRINT"
    LEGACY_NFT = "LEGACY_NFT"
    V2_NFT = "V2_NFT"
    FUNGIBLE_ASSET = "FungibleAsset"
    FUNGIBLE_TOKEN = "FungibleToken"
    CUSTOM = "Custom"
    IDENTITY = "Identity"
    EXECUTABLE = "Executable"
    PROGRAMMABLE_NFT = "ProgrammableNFT"


@dataclass
class AssetAuthority:
    """Authority information for an asset."""
    address: str
    scopes: List[str]


@dataclass
class AssetCompression:
    """Compression details for a Solana digital asset."""
    eligible: bool
    compressed: bool
    data_hash: str
    creator_hash: str
    asset_hash: str
    tree: str
    seq: int
    leaf_id: int


@dataclass
class AssetGrouping:
    """Grouping information for an asset."""
    group_key: str
    group_value: str


@dataclass
class AssetRoyalty:
    """Royalty information for a Solana digital asset."""
    royalty_model: str
    target: Optional[str]
    percent: float
    basis_points: int
    primary_sale_happened: bool
    locked: bool


@dataclass
class AssetCreator:
    """Creator information for a digital asset."""
    address: str
    share: int
    verified: bool


@dataclass
class AssetOwnership:
    """Ownership details of a Solana digital asset."""
    frozen: bool
    delegated: bool
    delegate: Optional[str]
    ownership_model: str
    owner: str


@dataclass
class AssetSupply:
    """Supply information for an asset."""
    print_max_supply: int
    print_current_supply: int
    edition_nonce: Optional[int] = None


@dataclass
class TokenInfo:
    """Token-specific information."""
    supply: int
    decimals: int
    token_program: str
    mint_authority: Optional[str] = None
    freeze_authority: Optional[str] = None


@dataclass
class AssetFile:
    """File information for an asset."""
    uri: str
    cdn_uri: Optional[str] = None
    mime: Optional[str] = None


@dataclass
class AssetAttribute:
    """Metadata attribute for an asset."""
    value: str
    trait_type: str


@dataclass
class AssetMetadata:
    """Metadata information for an asset."""
    name: str
    symbol: str
    description: Optional[str] = None
    token_standard: Optional[str] = None
    attributes: Optional[List[AssetAttribute]] = None


@dataclass
class AssetContent:
    """Content information of a Solana digital asset."""
    schema_url: Optional[str] = None  # $schema
    json_uri: Optional[str] = None
    files: Optional[List[AssetFile]] = None
    metadata: Optional[AssetMetadata] = None
    links: Optional[Dict[str, str]] = None


@dataclass
class AssetData:
    """Complete data for a Solana NFT or digital asset."""
    interface: str
    id: str
    content: Optional[AssetContent] = None
    authorities: Optional[List[AssetAuthority]] = None
    compression: Optional[AssetCompression] = None
    grouping: Optional[List[AssetGrouping]] = None
    royalty: Optional[AssetRoyalty] = None
    creators: Optional[List[AssetCreator]] = None
    ownership: Optional[AssetOwnership] = None
    supply: Optional[AssetSupply] = None
    mutable: Optional[bool] = None
    burnt: Optional[bool] = None
    token_info: Optional[TokenInfo] = None
    last_indexed_slot: Optional[int] = None


@dataclass
class AssetProof:
    """Cryptographic merkle proof for a compressed Solana NFT."""
    root: str
    proof: List[str]
    node_index: int
    leaf: str
    tree_id: str
    burnt: Optional[bool] = None


@dataclass
class PriorityFeeLevels:
    """Detailed fee estimates for different priority levels on Solana."""
    min: float
    low: float
    medium: float
    high: float
    very_high: float
    unsafe_max: float


@dataclass
class PriorityFeeEstimate:
    """Priority fee estimate result."""
    priority_fee_estimate: Optional[float] = None
    priority_fee_levels: Optional[PriorityFeeLevels] = None
