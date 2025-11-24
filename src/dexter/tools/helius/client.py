"""Helius RPC client for Solana NFT and asset data."""

import os
import requests
from typing import Optional, List, Dict, Any, Union
from dataclasses import asdict

from .types import (
    AssetData,
    AssetProof,
    PriorityFeeEstimate,
    AssetContent,
    AssetOwnership,
    AssetCompression,
    AssetAuthority,
    AssetGrouping,
    AssetRoyalty,
    AssetCreator,
    AssetSupply,
    TokenInfo,
    AssetFile,
    AssetAttribute,
    AssetMetadata,
    PriorityFeeLevels,
)


class HeliusClient:
    """Client for interacting with Helius RPC API."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        rpc_url: Optional[str] = None,
        network: str = "mainnet",
    ):
        """
        Initialize Helius client.

        Args:
            api_key: Helius API key (defaults to HELIUS_API_KEY env var)
            rpc_url: Custom RPC URL (defaults to HELIUS_RPC_URL env var)
            network: Network to use ('mainnet' or 'devnet')
        """
        self.api_key = api_key or os.getenv("HELIUS_API_KEY")
        if not self.api_key:
            raise ValueError("HELIUS_API_KEY must be provided or set in environment")

        # Use custom RPC URL if provided, otherwise construct from network
        if rpc_url:
            self.rpc_url = rpc_url
        elif os.getenv("HELIUS_RPC_URL"):
            self.rpc_url = os.getenv("HELIUS_RPC_URL") or ""
        else:
            base_url = f"https://{network}.helius-rpc.com"
            self.rpc_url = f"{base_url}/?api-key={self.api_key}"
        
        if not self.rpc_url:
            raise ValueError("RPC URL could not be determined")

    def _make_request(self, method: str, params: Union[Dict, List], wrap_params: bool = True) -> Dict[str, Any]:
        """
        Make a JSON-RPC request to Helius API.

        Args:
            method: The RPC method name
            params: Method parameters
            wrap_params: Whether to wrap params in a list (default True)

        Returns:
            Response result dictionary

        Raises:
            Exception: If the request fails
        """
        # Determine if params should be wrapped
        if wrap_params and not isinstance(params, list):
            params = [params]
        
        payload = {
            "jsonrpc": "2.0",
            "id": "1",
            "method": method,
            "params": params,
        }

        response = requests.post(self.rpc_url, json=payload)
        response.raise_for_status()

        data = response.json()
        if "error" in data:
            error = data["error"]
            raise Exception(f"RPC Error {error.get('code')}: {error.get('message')}")

        return data.get("result", {})

    def get_asset(
        self,
        asset_id: str,
        show_unverified_collections: bool = False,
        show_collection_metadata: bool = False,
        show_fungible: bool = False,
        show_inscription: bool = False,
    ) -> AssetData:
        """
        Retrieve comprehensive data for a Solana NFT or digital asset.

        Args:
            asset_id: The unique identifier (mint address) of the asset
            show_unverified_collections: Display unverified collections
            show_collection_metadata: Display collection metadata
            show_fungible: Display fungible tokens
            show_inscription: Display inscription details

        Returns:
            AssetData object with complete asset information
        """
        params = {
            "id": asset_id,
            "options": {
                "showUnverifiedCollections": show_unverified_collections,
                "showCollectionMetadata": show_collection_metadata,
                "showFungible": show_fungible,
                "showInscription": show_inscription,
            },
        }

        result = self._make_request("getAsset", params, wrap_params=False)
        return self._parse_asset_data(result)

    def get_asset_batch(
        self,
        asset_ids: List[str],
        show_unverified_collections: bool = False,
        show_collection_metadata: bool = False,
        show_fungible: bool = False,
        show_inscription: bool = False,
    ) -> List[AssetData]:
        """
        Retrieve data for multiple assets in a single batch request.

        Args:
            asset_ids: List of asset IDs to retrieve
            show_unverified_collections: Display unverified collections
            show_collection_metadata: Display collection metadata
            show_fungible: Display fungible tokens
            show_inscription: Display inscription details

        Returns:
            List of AssetData objects
        """
        params = {
            "ids": asset_ids,
            "options": {
                "showUnverifiedCollections": show_unverified_collections,
                "showCollectionMetadata": show_collection_metadata,
                "showFungible": show_fungible,
                "showInscription": show_inscription,
            },
        }

        result = self._make_request("getAssetBatch", params, wrap_params=False)
        # getAssetBatch returns an array directly
        if isinstance(result, list):
            return [self._parse_asset_data(asset) for asset in result if isinstance(asset, dict)]
        return []

    def get_asset_proof(self, asset_id: str) -> AssetProof:
        """
        Retrieve the cryptographic merkle proof for a compressed NFT.

        Args:
            asset_id: The unique identifier of the compressed asset

        Returns:
            AssetProof object with merkle proof data
        """
        params = {"id": asset_id}
        result = self._make_request("getAssetProof", params, wrap_params=False)

        return AssetProof(
            root=result["root"],
            proof=result["proof"],
            node_index=result["node_index"],
            leaf=result["leaf"],
            tree_id=result["tree_id"],
            burnt=result.get("burnt"),
        )

    def get_assets_by_owner(
        self,
        owner_address: str,
        page: int = 1,
        limit: int = 100,
        show_unverified_collections: bool = False,
        show_collection_metadata: bool = False,
        show_fungible: bool = False,
        show_native_balance: bool = False,
        show_inscription: bool = False,
        show_zero_balance: bool = False,
    ) -> Dict[str, Any]:
        """
        Retrieve all digital assets owned by a specific wallet address.

        Args:
            owner_address: The Solana wallet address
            page: Page number for pagination
            limit: Maximum number of assets to return
            show_unverified_collections: Display unverified collections
            show_collection_metadata: Display collection metadata
            show_fungible: Display fungible tokens
            show_native_balance: Display native SOL balance
            show_inscription: Display inscription details
            show_zero_balance: Display assets with zero balance

        Returns:
            Dictionary with assets and pagination info
        """
        params = {
            "ownerAddress": owner_address,
            "page": page,
            "limit": limit,
            "options": {
                "showUnverifiedCollections": show_unverified_collections,
                "showCollectionMetadata": show_collection_metadata,
                "showFungible": show_fungible,
                "showNativeBalance": show_native_balance,
                "showInscription": show_inscription,
                "showZeroBalance": show_zero_balance,
            },
        }

        result = self._make_request("getAssetsByOwner", params, wrap_params=False)
        return {
            "total": result.get("total", 0),
            "limit": result.get("limit", 0),
            "page": result.get("page", 0),
            "items": [self._parse_asset_data(asset) for asset in result.get("items", [])],
        }

    def search_assets(
        self,
        owner_address: str,
        token_type: str = "all",
        page: int = 1,
        limit: int = 100,
        **kwargs,
    ) -> Dict[str, Any]:
        """
        Search and discover Solana digital assets with filtering options.

        Args:
            owner_address: The Solana wallet address
            token_type: Type of token ('fungible', 'nonFungible', 'regularNft', 'compressedNft', 'all')
            page: Page number for pagination
            limit: Maximum number of assets to return
            **kwargs: Additional filter options

        Returns:
            Dictionary with search results and pagination info
        """
        params = {
            "ownerAddress": owner_address,
            "tokenType": token_type,
            "page": page,
            "limit": limit,
        }

        # Add optional filters
        if "compressed" in kwargs:
            params["compressed"] = kwargs["compressed"]
        if "grouping" in kwargs:
            params["grouping"] = kwargs["grouping"]
        if "creator_address" in kwargs:
            params["creatorAddress"] = kwargs["creator_address"]

        result = self._make_request("searchAssets", params, wrap_params=False)
        
        assets = result.get("assets", {})
        return {
            "total": assets.get("total", 0),
            "limit": assets.get("limit", 0),
            "page": assets.get("page", 0),
            "items": [self._parse_asset_data(asset) for asset in assets.get("items", [])],
            "native_balance": result.get("nativeBalance"),
        }

    def get_priority_fee_estimate(
        self,
        transaction: Optional[str] = None,
        account_keys: Optional[List[str]] = None,
        priority_level: Optional[str] = None,
        include_all_priority_fee_levels: bool = False,
    ) -> PriorityFeeEstimate:
        """
        Calculate optimal priority fee recommendations for Solana transactions.

        Args:
            transaction: Base58 or Base64 encoded transaction
            account_keys: Alternative to transaction - list of account keys
            priority_level: Specific priority level ('Min', 'Low', 'Medium', 'High', 'VeryHigh', 'UnsafeMax')
            include_all_priority_fee_levels: Return all priority levels

        Returns:
            PriorityFeeEstimate object with fee recommendations
        """
        params = {}
        
        if transaction:
            params["transaction"] = transaction
        elif account_keys:
            params["accountKeys"] = account_keys
        else:
            raise ValueError("Either transaction or account_keys must be provided")

        options = {}
        if priority_level:
            options["priorityLevel"] = priority_level
        if include_all_priority_fee_levels:
            options["includeAllPriorityFeeLevels"] = True

        if options:
            params["options"] = options

        result = self._make_request("getPriorityFeeEstimate", [params])

        fee_estimate = PriorityFeeEstimate()
        
        if "priorityFeeEstimate" in result:
            fee_estimate.priority_fee_estimate = result["priorityFeeEstimate"]
        
        if "priorityFeeLevels" in result:
            levels = result["priorityFeeLevels"]
            fee_estimate.priority_fee_levels = PriorityFeeLevels(
                min=levels["min"],
                low=levels["low"],
                medium=levels["medium"],
                high=levels["high"],
                very_high=levels["veryHigh"],
                unsafe_max=levels["unsafeMax"],
            )

        return fee_estimate

    def _parse_asset_data(self, data: Dict[str, Any]) -> AssetData:
        """Parse raw API response into AssetData object."""
        # Parse content
        content = None
        if "content" in data and data["content"]:
            content_data = data["content"]
            
            # Parse files
            files = None
            if "files" in content_data and content_data["files"]:
                files = [
                    AssetFile(
                        uri=f["uri"],
                        cdn_uri=f.get("cdn_uri"),
                        mime=f.get("mime"),
                    )
                    for f in content_data["files"]
                ]

            # Parse metadata
            metadata = None
            if "metadata" in content_data and content_data["metadata"]:
                meta = content_data["metadata"]
                attributes = None
                if "attributes" in meta and meta["attributes"]:
                    attributes = [
                        AssetAttribute(value=attr["value"], trait_type=attr["trait_type"])
                        for attr in meta["attributes"]
                    ]
                metadata = AssetMetadata(
                    name=meta.get("name", ""),
                    symbol=meta.get("symbol", ""),
                    description=meta.get("description"),
                    token_standard=meta.get("token_standard"),
                    attributes=attributes,
                )

            content = AssetContent(
                schema_url=content_data.get("$schema"),
                json_uri=content_data.get("json_uri"),
                files=files,
                metadata=metadata,
                links=content_data.get("links"),
            )

        # Parse authorities
        authorities = None
        if "authorities" in data and data["authorities"]:
            authorities = [
                AssetAuthority(address=auth["address"], scopes=auth["scopes"])
                for auth in data["authorities"]
            ]

        # Parse compression
        compression = None
        if "compression" in data and data["compression"]:
            comp = data["compression"]
            compression = AssetCompression(
                eligible=comp["eligible"],
                compressed=comp["compressed"],
                data_hash=comp["data_hash"],
                creator_hash=comp["creator_hash"],
                asset_hash=comp["asset_hash"],
                tree=comp["tree"],
                seq=comp["seq"],
                leaf_id=comp["leaf_id"],
            )

        # Parse grouping
        grouping = None
        if "grouping" in data and data["grouping"]:
            grouping = [
                AssetGrouping(group_key=g["group_key"], group_value=g["group_value"])
                for g in data["grouping"]
            ]

        # Parse royalty
        royalty = None
        if "royalty" in data and data["royalty"]:
            roy = data["royalty"]
            royalty = AssetRoyalty(
                royalty_model=roy["royalty_model"],
                target=roy.get("target"),
                percent=roy["percent"],
                basis_points=roy["basis_points"],
                primary_sale_happened=roy["primary_sale_happened"],
                locked=roy["locked"],
            )

        # Parse creators
        creators = None
        if "creators" in data and data["creators"]:
            creators = [
                AssetCreator(
                    address=c["address"], share=c["share"], verified=c["verified"]
                )
                for c in data["creators"]
            ]

        # Parse ownership
        ownership = None
        if "ownership" in data and data["ownership"]:
            own = data["ownership"]
            ownership = AssetOwnership(
                frozen=own["frozen"],
                delegated=own["delegated"],
                delegate=own.get("delegate"),
                ownership_model=own["ownership_model"],
                owner=own["owner"],
            )

        # Parse supply
        supply = None
        if "supply" in data and data["supply"]:
            sup = data["supply"]
            supply = AssetSupply(
                print_max_supply=sup["print_max_supply"],
                print_current_supply=sup["print_current_supply"],
                edition_nonce=sup.get("edition_nonce"),
            )

        # Parse token_info
        token_info = None
        if "token_info" in data and data["token_info"]:
            ti = data["token_info"]
            token_info = TokenInfo(
                supply=ti["supply"],
                decimals=ti["decimals"],
                token_program=ti["token_program"],
                mint_authority=ti.get("mint_authority"),
                freeze_authority=ti.get("freeze_authority"),
            )

        return AssetData(
            interface=data["interface"],
            id=data["id"],
            content=content,
            authorities=authorities,
            compression=compression,
            grouping=grouping,
            royalty=royalty,
            creators=creators,
            ownership=ownership,
            supply=supply,
            mutable=data.get("mutable"),
            burnt=data.get("burnt"),
            token_info=token_info,
            last_indexed_slot=data.get("last_indexed_slot"),
        )
