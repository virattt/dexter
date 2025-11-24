# Helius RPC API Integration

Complete Python integration for Helius RPC API, enabling comprehensive Solana NFT and digital asset data retrieval.

## Features

- ✅ **getAsset** - Retrieve comprehensive data for any Solana NFT or digital asset
- ✅ **getAssetBatch** - Fetch multiple assets in a single batch request
- ✅ **getAssetProof** - Get cryptographic merkle proofs for compressed NFTs
- ✅ **getAssetsByOwner** - List all assets owned by a wallet address
- ✅ **searchAssets** - Advanced search with filtering options
- ✅ **getPriorityFeeEstimate** - Calculate optimal priority fees for transactions

## Setup

### 1. Environment Variables

Add your Helius credentials to the `.env` file:

```bash
HELIUS_API_KEY=your-api-key-here
HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=your-api-key-here
```

You can get a free API key from [Helius Dashboard](https://dashboard.helius.dev/api-keys).

### 2. Installation

The integration uses the Solana Python library which is already included in the project:

```bash
pip install requests  # Only additional dependency needed
```

## Usage

### Basic Example

```python
from dexter.tools.helius import HeliusClient

# Initialize client (automatically uses environment variables)
client = HeliusClient()

# Get a specific NFT
asset = client.get_asset("F9Lw3ki3hJ7PF9HQXsBzoY8GyE6sPoEZZdXJBsTTD2rk")

print(f"Name: {asset.content.metadata.name}")
print(f"Owner: {asset.ownership.owner}")
print(f"Interface: {asset.interface}")
```

### Advanced Examples

#### 1. Get Asset with Full Metadata

```python
asset = client.get_asset(
    asset_id="F9Lw3ki3hJ7PF9HQXsBzoY8GyE6sPoEZZdXJBsTTD2rk",
    show_unverified_collections=True,
    show_collection_metadata=True,
    show_inscription=True
)

# Access metadata
if asset.content.metadata:
    print(f"Name: {asset.content.metadata.name}")
    print(f"Symbol: {asset.content.metadata.symbol}")
    
    # Access attributes/traits
    if asset.content.metadata.attributes:
        for attr in asset.content.metadata.attributes:
            print(f"{attr.trait_type}: {attr.value}")

# Access ownership
if asset.ownership:
    print(f"Owner: {asset.ownership.owner}")
    print(f"Frozen: {asset.ownership.frozen}")
    print(f"Delegated: {asset.ownership.delegated}")

# Access royalty info
if asset.royalty:
    print(f"Royalty: {asset.royalty.percent * 100}%")
    print(f"Basis Points: {asset.royalty.basis_points}")
```

#### 2. Get All Assets Owned by a Wallet

```python
result = client.get_assets_by_owner(
    owner_address="86xCnPeV69n6t3DnyGvkKobf9FdN2H9oiVDdaMpo2MMY",
    page=1,
    limit=100,
    show_fungible=True,
    show_native_balance=True
)

print(f"Total assets: {result['total']}")
print(f"Page: {result['page']}")

for asset in result['items']:
    name = asset.content.metadata.name if asset.content.metadata else "Unknown"
    print(f"- {name} ({asset.interface})")
```

#### 3. Search Assets with Filters

```python
# Search for compressed NFTs only
result = client.search_assets(
    owner_address="86xCnPeV69n6t3DnyGvkKobf9FdN2H9oiVDdaMpo2MMY",
    token_type="compressedNft",
    compressed=True,
    limit=50
)

# Search by collection
result = client.search_assets(
    owner_address="wallet_address",
    token_type="nonFungible",
    grouping=["collection", "J1S9H3QjnRtBbbuD4HjPV6RpRhwuk4zKbxsnCHuTgh9w"]
)
```

#### 4. Get Compressed NFT Proof

```python
proof = client.get_asset_proof("Bu1DEKeawy7txbnCEJE4BU3BKLXaNAKCYcHR4XhndGss")

print(f"Tree ID: {proof.tree_id}")
print(f"Root: {proof.root}")
print(f"Leaf: {proof.leaf}")
print(f"Proof hashes: {len(proof.proof)}")
```

#### 5. Get Priority Fee Estimates

```python
# Using transaction
fee_estimate = client.get_priority_fee_estimate(
    transaction="base58_encoded_transaction",
    include_all_priority_fee_levels=True
)

# Using account keys
fee_estimate = client.get_priority_fee_estimate(
    account_keys=["2CiBfRKcERi2GgYn83UaGo1wFaYHHrXGGfnDaa2hxdEA"],
    include_all_priority_fee_levels=True
)

if fee_estimate.priority_fee_levels:
    levels = fee_estimate.priority_fee_levels
    print(f"Low: {levels.low} microlamports")
    print(f"Medium: {levels.medium} microlamports")
    print(f"High: {levels.high} microlamports")
```

#### 6. Batch Get Multiple Assets

```python
asset_ids = [
    "F9Lw3ki3hJ7PF9HQXsBzoY8GyE6sPoEZZdXJBsTTD2rk",
    "JEGruwYE13mhX2wi2MGrPmeLiVyZtbBptmVy9vG3pXRC",
]

assets = client.get_asset_batch(
    asset_ids=asset_ids,
    show_collection_metadata=True
)

for asset in assets:
    print(f"ID: {asset.id}")
    print(f"Name: {asset.content.metadata.name if asset.content.metadata else 'Unknown'}")
```

## API Reference

### HeliusClient

#### Constructor

```python
HeliusClient(
    api_key: Optional[str] = None,
    rpc_url: Optional[str] = None,
    network: str = "mainnet"
)
```

- `api_key`: Helius API key (defaults to `HELIUS_API_KEY` env var)
- `rpc_url`: Custom RPC URL (defaults to `HELIUS_RPC_URL` env var)
- `network`: Network to use ('mainnet' or 'devnet')

#### Methods

##### get_asset()

Retrieve comprehensive data for a Solana NFT or digital asset.

```python
get_asset(
    asset_id: str,
    show_unverified_collections: bool = False,
    show_collection_metadata: bool = False,
    show_fungible: bool = False,
    show_inscription: bool = False
) -> AssetData
```

##### get_asset_batch()

Retrieve multiple assets in a single batch request.

```python
get_asset_batch(
    asset_ids: List[str],
    show_unverified_collections: bool = False,
    show_collection_metadata: bool = False,
    show_fungible: bool = False,
    show_inscription: bool = False
) -> List[AssetData]
```

##### get_asset_proof()

Get the cryptographic merkle proof for a compressed NFT.

```python
get_asset_proof(asset_id: str) -> AssetProof
```

##### get_assets_by_owner()

Retrieve all digital assets owned by a wallet address.

```python
get_assets_by_owner(
    owner_address: str,
    page: int = 1,
    limit: int = 100,
    show_unverified_collections: bool = False,
    show_collection_metadata: bool = False,
    show_fungible: bool = False,
    show_native_balance: bool = False,
    show_inscription: bool = False,
    show_zero_balance: bool = False
) -> Dict[str, Any]
```

##### search_assets()

Search and discover Solana digital assets with filtering.

```python
search_assets(
    owner_address: str,
    token_type: str = "all",  # 'fungible', 'nonFungible', 'regularNft', 'compressedNft', 'all'
    page: int = 1,
    limit: int = 100,
    **kwargs  # Additional filters: compressed, grouping, creator_address
) -> Dict[str, Any]
```

##### get_priority_fee_estimate()

Calculate optimal priority fee recommendations.

```python
get_priority_fee_estimate(
    transaction: Optional[str] = None,
    account_keys: Optional[List[str]] = None,
    priority_level: Optional[str] = None,
    include_all_priority_fee_levels: bool = False
) -> PriorityFeeEstimate
```

## Data Types

### AssetData

Complete data for a Solana NFT or digital asset.

**Fields:**
- `interface`: Token standard (V1_NFT, ProgrammableNFT, etc.)
- `id`: Mint address
- `content`: Metadata, files, and content
- `authorities`: Update authorities
- `compression`: Compression status and merkle tree info
- `grouping`: Collection information
- `royalty`: Royalty configuration
- `creators`: Creator addresses and shares
- `ownership`: Owner address and delegation
- `supply`: Supply information for editions
- `mutable`: Whether metadata is mutable
- `burnt`: Whether asset has been burned
- `token_info`: Token-specific information

### AssetContent

Content and metadata information.

**Fields:**
- `schema_url`: Metadata schema URL
- `json_uri`: URI to JSON metadata
- `files`: List of asset files (images, etc.)
- `metadata`: Asset metadata (name, symbol, attributes)
- `links`: External links

### AssetOwnership

Ownership details.

**Fields:**
- `owner`: Owner wallet address
- `frozen`: Whether asset is frozen
- `delegated`: Whether asset is delegated
- `delegate`: Delegate address (if delegated)
- `ownership_model`: Ownership model type

## Running Examples

Run the example script to test the integration:

```bash
python examples/helius_example.py
```

This will demonstrate:
1. Getting a specific NFT asset
2. Getting assets by owner
3. Getting compressed NFT proof
4. Searching assets with filters
5. Getting priority fee estimates
6. Batch getting multiple assets

## Error Handling

```python
try:
    asset = client.get_asset("invalid_id")
except Exception as e:
    print(f"Error: {e}")
    # Handle RPC errors, network errors, etc.
```

Common errors:
- `ValueError`: Missing API key or invalid parameters
- `HTTPError`: Network/API errors
- `Exception`: RPC errors (invalid asset ID, rate limits, etc.)

## Rate Limits

Helius free tier includes generous rate limits. For production use, consider upgrading your plan at [Helius Pricing](https://www.helius.dev/pricing).

## Support

- [Helius Documentation](https://docs.helius.dev/)
- [Helius Discord](https://discord.gg/helius)
- [API Reference](https://docs.helius.dev/api-reference)

## License

This integration is part of the Dexter project and follows the same license.
