# src/solana_agentkit/tools/deploy_collection.py

from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from metaplex.metadata import create_metadata_account_v3 # type: ignore
from metaplex.utils import create_master_edition # type: ignore
from metaplex.metadata import get_metadata_account # type: ignore
from rsa import PublicKey
from solana.transaction import Transaction

from solana.rpc.commitment import Confirmed
import base58

from solana_agentkit.agent.solana_agent import SolanaAgent
from solana_agentkit.types.account import CreateAccountParams, create_account

@dataclass
class Creator:
    """Represents a creator of an NFT collection."""
    address: str
    percentage: int

@dataclass
class CollectionOptions:
    """Configuration options for deploying an NFT collection."""
    name: str
    uri: str
    royalty_basis_points: Optional[int] = 500  # Default 5%
    creators: Optional[List[Creator]] = None

@dataclass
class CollectionDeployment:
    """Result of a collection deployment."""
    collection_address: PublicKey
    signature: str

async def deploy_collection(
    agent: 'SolanaAgent',
    options: CollectionOptions
) -> CollectionDeployment:
    """
    Deploy a new NFT collection on Solana.
    
    Args:
        agent: Instance of SolanaAgentKit
        options: Collection configuration options
    
    Returns:
        CollectionDeployment object containing collection address and transaction signature
    
    Raises:
        Exception: If collection deployment fails
    """
    try:
        # Generate collection mint account
        collection_mint = PublicKey.new_unique()
        
        # Format creators list
        formatted_creators = []
        if options.creators:
            formatted_creators = [
                {
                    "address": PublicKey(creator.address),
                    "share": creator.percentage,
                    "verified": creator.address == str(agent.wallet_address)
                }
                for creator in options.creators
            ]
        else:
            formatted_creators = [{
                "address": agent.wallet_address,
                "share": 100,
                "verified": True
            }]

        # Calculate required space for metadata
        metadata_space = 1024  # Base size for metadata

        # Create transaction
        tx = Transaction()

        # Create mint account
        create_mint_account_ix = create_account(
            CreateAccountParams(
                from_pubkey=agent.wallet_address,
                to_pubkey=collection_mint,
                lamports=await agent.connection.get_minimum_balance_for_rent_exemption(metadata_space),
                space=metadata_space,
                program_id=PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
            )
        )
        tx.add(create_mint_account_ix)

        # Get metadata account address
        metadata_account = get_metadata_account(collection_mint)
        
        # Create metadata account
        metadata_ix = create_metadata_account_v3(
            metadata_account=metadata_account,
            mint=collection_mint,
            mint_authority=agent.wallet_address,
            payer=agent.wallet_address,
            update_authority=agent.wallet_address,
            data={
                "name": options.name,
                "symbol": options.name[:4].upper(),  # Use first 4 chars of name as symbol
                "uri": options.uri,
                "seller_fee_basis_points": options.royalty_basis_points,
                "creators": formatted_creators,
                "collection": None,
                "uses": None
            },
            is_mutable=True,
            collection_details=True  # Indicates this is a collection
        )
        tx.add(metadata_ix)

        # Create master edition
        master_edition_ix = create_master_edition(
            mint=collection_mint,
            update_authority=agent.wallet_address,
            mint_authority=agent.wallet_address,
            payer=agent.wallet_address,
            max_supply=0  # Unlimited supply for collection
        )
        tx.add(master_edition_ix)

        # Sign and send transaction
        result = await agent.connection.send_transaction(
            tx,
            [agent.wallet],
            commitment=Confirmed
        )

        return CollectionDeployment(
            collection_address=collection_mint,
            signature=base58.b58encode(result.value.signature).decode('ascii')
        )

    except Exception as error:
        raise Exception(f"Collection deployment failed: {str(error)}") from error

def validate_collection_options(options: CollectionOptions) -> None:
    """
    Validate collection deployment options.
    
    Args:
        options: Collection options to validate
        
    Raises:
        ValueError: If options are invalid
    """
    if not options.name:
        raise ValueError("Collection name is required")
        
    if not options.uri:
        raise ValueError("Collection URI is required")
        
    if options.royalty_basis_points is not None:
        if not 0 <= options.royalty_basis_points <= 10000:
            raise ValueError("Royalty basis points must be between 0 and 10000")
            
    if options.creators:
        total_shares = sum(creator.percentage for creator in options.creators)
        if total_shares != 100:
            raise ValueError("Creator shares must sum to 100")