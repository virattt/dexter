from goat.decorators.tool import Tool
from goat_wallets.evm import EVMWalletClient
from typing import Dict, Any, List

from .parameters import CollectionParameters, MintNFTParameters, EmptyParameters
from .api_client import CrossmintWalletsAPI
from .chains import get_crossmint_chain_string, is_story_chain


class CrossmintMintService:
    def __init__(self, api_client: CrossmintWalletsAPI):
        self.api_client = api_client

    def _get_endpoint_root(self, chain: str) -> str:
        """Get the appropriate endpoint root based on chain type.
        
        Args:
            chain: Chain identifier
            
        Returns:
            str: API endpoint root path
        """
        return "/api/v1/ip" if is_story_chain(chain) else "/api/2022-06-09"

    @Tool({
        "description": "Create a new NFT collection",
        "parameters_schema": CollectionParameters
    })
    def create_collection(self, wallet_client: EVMWalletClient, parameters: dict) -> dict:
        try:
            chain = get_crossmint_chain_string(wallet_client.get_chain())
            
            result = self.api_client.create_collection(parameters, chain)
            if result.get("error"):
                raise Exception(result["message"])
            
            action = self.api_client.wait_for_action(result["actionId"])
            
            return {
                "collectionId": result["id"],
                "chain": chain,
                "contractAddress": action["data"]["collection"]["contractAddress"]
            }
        except Exception as error:
            raise Exception(f"Failed to create collection: {error}")

    @Tool({
        "description": "Get all collections",
        "parameters_schema": EmptyParameters
    })
    def get_all_collections(self, wallet_client: EVMWalletClient, parameters: dict) -> List[Dict[str, Any]]:
        try:
            chain = get_crossmint_chain_string(wallet_client.get_chain())
            collections = self.api_client.get_all_collections(chain)
            return list(collections.values()) if isinstance(collections, dict) else collections
        except Exception as error:
            raise Exception(f"Failed to get collections: {error}")

    @Tool({
        "description": "Mint an NFT in a collection",
        "parameters_schema": MintNFTParameters
    })
    def mint_nft(self, wallet_client: EVMWalletClient, parameters: dict) -> dict:
        try:
            chain = get_crossmint_chain_string(wallet_client.get_chain())
            
            # Format recipient appropriately based on chain and recipient type
            recipient = f"email:{parameters['recipient']}:{chain}" if parameters["recipient_type"] == "email" else f"{chain}:{parameters['recipient']}"
            
            result = self.api_client.mint_nft(
                parameters["collection_id"],
                recipient,
                parameters["metadata"],
                chain
            )
            
            if result.get("error"):
                raise Exception(result["message"])
            
            action = self.api_client.wait_for_action(result["actionId"])
            
            return {
                "id": result["id"],
                "collectionId": parameters["collection_id"],
                "contractAddress": result["onChain"]["contractAddress"],
                "chain": action["data"]["chain"]
            }
        except Exception as error:
            raise Exception(f"Failed to mint NFT: {error}")
