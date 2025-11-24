"""Example usage of Helius RPC API integration."""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
env_path = Path(__file__).parent.parent / "env"
load_dotenv(env_path)

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from dexter.tools.helius import HeliusClient


def main():
    """Demonstrate Helius API functionality."""
    
    # Initialize client (uses HELIUS_API_KEY and HELIUS_RPC_URL from environment)
    client = HeliusClient()
    
    print("=" * 80)
    print("Helius RPC API Examples")
    print("=" * 80)
    
    # Example 1: Get a specific NFT asset
    print("\n1. Getting specific NFT asset (Mad Lads #8420)...")
    try:
        asset_id = "F9Lw3ki3hJ7PF9HQXsBzoY8GyE6sPoEZZdXJBsTTD2rk"
        asset = client.get_asset(asset_id)
        
        print(f"   Asset ID: {asset.id}")
        print(f"   Interface: {asset.interface}")
        
        if asset.content and asset.content.metadata:
            print(f"   Name: {asset.content.metadata.name}")
            print(f"   Symbol: {asset.content.metadata.symbol}")
            print(f"   Description: {asset.content.metadata.description}")
            
            if asset.content.metadata.attributes:
                print(f"   Attributes ({len(asset.content.metadata.attributes)}):")
                for attr in asset.content.metadata.attributes[:3]:  # Show first 3
                    print(f"     - {attr.trait_type}: {attr.value}")
        
        if asset.ownership:
            print(f"   Owner: {asset.ownership.owner}")
            print(f"   Frozen: {asset.ownership.frozen}")
        
        if asset.royalty:
            print(f"   Royalty: {asset.royalty.percent * 100}% ({asset.royalty.basis_points} basis points)")
            
    except Exception as e:
        print(f"   Error: {e}")
    
    # Example 2: Get assets by owner
    print("\n2. Getting assets by owner...")
    try:
        owner = "86xCnPeV69n6t3DnyGvkKobf9FdN2H9oiVDdaMpo2MMY"
        result = client.get_assets_by_owner(
            owner_address=owner,
            limit=5,
            show_fungible=True
        )
        
        print(f"   Total assets: {result['total']}")
        print(f"   Showing: {len(result['items'])} of {result['total']}")
        
        for idx, asset in enumerate(result['items'][:3], 1):
            name = "Unknown"
            if asset.content and asset.content.metadata:
                name = asset.content.metadata.name or "Unknown"
            print(f"   {idx}. {name} ({asset.interface})")
            
    except Exception as e:
        print(f"   Error: {e}")
    
    # Example 3: Get compressed NFT proof
    print("\n3. Getting compressed NFT proof...")
    try:
        compressed_nft_id = "Bu1DEKeawy7txbnCEJE4BU3BKLXaNAKCYcHR4XhndGss"
        proof = client.get_asset_proof(compressed_nft_id)
        
        print(f"   Tree ID: {proof.tree_id}")
        print(f"   Leaf: {proof.leaf}")
        print(f"   Node Index: {proof.node_index}")
        print(f"   Proof hashes: {len(proof.proof)}")
        print(f"   Root: {proof.root}")
        
    except Exception as e:
        print(f"   Error: {e}")
    
    # Example 4: Search assets with filters
    print("\n4. Searching assets (compressed NFTs only)...")
    try:
        owner = "86xCnPeV69n6t3DnyGvkKobf9FdN2H9oiVDdaMpo2MMY"
        result = client.search_assets(
            owner_address=owner,
            token_type="compressedNft",
            limit=3
        )
        
        print(f"   Found {result['total']} compressed NFTs")
        for idx, asset in enumerate(result['items'], 1):
            name = "Unknown"
            if asset.content and asset.content.metadata:
                name = asset.content.metadata.name or "Unknown"
            compressed = asset.compression.compressed if asset.compression else False
            print(f"   {idx}. {name} (Compressed: {compressed})")
            
    except Exception as e:
        print(f"   Error: {e}")
    
    # Example 5: Get priority fee estimates
    print("\n5. Getting priority fee estimates...")
    try:
        # Using account keys instead of transaction
        account_keys = ["2CiBfRKcERi2GgYn83UaGo1wFaYHHrXGGfnDaa2hxdEA"]
        
        fee_estimate = client.get_priority_fee_estimate(
            account_keys=account_keys,
            include_all_priority_fee_levels=True
        )
        
        if fee_estimate.priority_fee_levels:
            levels = fee_estimate.priority_fee_levels
            print(f"   Min: {levels.min:,.0f} microlamports")
            print(f"   Low: {levels.low:,.0f} microlamports")
            print(f"   Medium: {levels.medium:,.0f} microlamports")
            print(f"   High: {levels.high:,.0f} microlamports")
            print(f"   Very High: {levels.very_high:,.0f} microlamports")
            print(f"   Unsafe Max: {levels.unsafe_max:,.0f} microlamports")
            
    except Exception as e:
        print(f"   Error: {e}")
    
    # Example 6: Batch get multiple assets
    print("\n6. Batch getting multiple assets...")
    try:
        asset_ids = [
            "F9Lw3ki3hJ7PF9HQXsBzoY8GyE6sPoEZZdXJBsTTD2rk",
        ]
        
        assets = client.get_asset_batch(asset_ids)
        
        print(f"   Retrieved {len(assets)} assets")
        for asset in assets:
            name = "Unknown"
            if asset.content and asset.content.metadata:
                name = asset.content.metadata.name or "Unknown"
            print(f"   - {name} ({asset.interface})")
            
    except Exception as e:
        print(f"   Error: {e}")
    
    print("\n" + "=" * 80)
    print("Examples completed!")
    print("=" * 80)


if __name__ == "__main__":
    main()
