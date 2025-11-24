# src/solana_agentkit/tools/mint_nft.py

from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from rsa import PublicKey
from solana.rpc.commitment import Confirmed
from solana.transaction import Transaction
from metaplex.metadata import (
    create_metadata_account_v3,
    create_master_edition_v3,
    Collection,
    Creator,
    DataV2
)
import base58

from solana_agentkit.agent.solana_agent import SolanaAgent
from solana_agentkit.utils import keypair

@dataclass
class NFTMetadata:
    """Metadata for NFT creation."""
    name: str
    symbol: str
    uri: str
    seller_fee_basis_points: Optional[int] = 0
    creators: Optional[List[Dict[str, Any]]] = None

@dataclass
class MintNFTResponse:
    """Response from NFT minting operation."""
    mint: PublicKey
    metadata: PublicKey
    token_account: PublicKey
    edition: Optional[PublicKey] = None

async def mint_collection_nft(
    agent: 'SolanaAgent',
    collection_mint: PublicKey,
    metadata: NFTMetadata,
    recipient: Optional[PublicKey] = None
) -> MintNFTResponse:
    """
    Mint a new NFT as part of an existing collection.
    
    Args:
        agent: SolanaAgentKit instance
        collection_mint: Address of the collection's master NFT
        metadata: NFT metadata information
        recipient: Optional recipient address (defaults to wallet address)
        
    Returns:
        MintNFTResponse containing mint and metadata addresses
        
    Raises:
        Exception: If NFT minting fails
    """
    try:
        # Use wallet address if no recipient specified
        recipient = recipient or agent.wallet_address
        
        # Generate new mint keypair for NFT
        mint_keypair = keypair()
        
        # Format creators if provided
        creators = []
        if metadata.creators:
            creators = [
                Creator(
                    address=PublicKey(creator['address']),
                    verified=creator['address'] == str(agent.wallet_address),
                    share=creator['share']
                )
                for creator in metadata.creators
            ]
        else:
            creators = [
                Creator(
                    address=agent.wallet_address,
                    verified=True,
                    share=100
                )
            ]

        # Fetch collection metadata
        collection_metadata = await agent.connection.get_account_info(
            PublicKey.find_program_address(
                [b'metadata', collection_mint.to_bytes()]
            )[0]
        )
        
        if not collection_metadata:
            raise Exception("Collection metadata not found")

        # Create transaction
        tx = Transaction()

        # Create metadata account
        metadata_address = PublicKey.find_program_address(
            [b'metadata', mint_keypair.public_key.to_bytes()]
        )[0]
        
        metadata_ix = create_metadata_account_v3(
            metadata_account=metadata_address,
            mint=mint_keypair.public_key,
            mint_authority=agent.wallet_address,
            payer=agent.wallet_address,
            update_authority=agent.wallet_address,
            data=DataV2(
                name=metadata.name,
                symbol=metadata.symbol,
                uri=metadata.uri,
                seller_fee_basis_points=metadata.seller_fee_basis_points,
                creators=creators,
                collection=Collection(
                    verified=False,
                    key=collection_mint
                ),
                uses=None
            )
        )
        tx.add(metadata_ix)

        # Create master edition
        edition_address = PublicKey.find_program_address(
            [b'metadata', b'edition', mint_keypair.public_key.to_bytes()]
        )[0]
        
        edition_ix = create_master_edition_v3(
            edition=edition_address,
            mint=mint_keypair.public_key,
            update_authority=agent.wallet_address,
            mint_authority=agent.wallet_address,
            payer=agent.wallet_address,
            metadata=metadata_address,
            max_supply=0
        )
        tx.add(edition_ix)

        # Send transaction
        result = await agent.connection.send_transaction(
            tx,
            [agent.wallet, mint_keypair],
            opts={
                "skip_preflight": False,
                "preflight_commitment": Confirmed,
                "max_retries": 3
            }
        )
        
        await agent.connection.confirm_transaction(
            result.value.signature,
            commitment=Confirmed
        )

        # Get token account address
        token_account = await get_associated_token_address(
            mint_keypair.public_key,
            recipient
        )

        return MintNFTResponse(
            mint=mint_keypair.public_key,
            metadata=metadata_address,
            token_account=token_account,
            edition=edition_address
        )

    except Exception as error:
        raise Exception(f"Collection NFT minting failed: {str(error)}") from error

async def get_associated_token_address(
    mint: PublicKey,
    owner: PublicKey
) -> PublicKey:
    """Get the associated token account address for a mint and owner."""
    return PublicKey.find_program_address(
        [
            bytes(owner),
            bytes(PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")),
            bytes(mint)
        ],
        PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
    )[0]

class NFTMinter:
    """Helper class for minting NFTs."""
    
    def __init__(self, agent: 'SolanaAgent'):
        self.agent = agent
        
    async def mint_to_collection(
        self,
        collection_mint: PublicKey,
        name: str,
        symbol: str,
        uri: str,
        recipient: Optional[PublicKey] = None,
        seller_fee_basis_points: int = 0,
        creators: Optional[List[Dict[str, Any]]] = None
    ) -> MintNFTResponse:
        """Mint a new NFT to a collection."""
        metadata = NFTMetadata(
            name=name,
            symbol=symbol,
            uri=uri,
            seller_fee_basis_points=seller_fee_basis_points,
            creators=creators
        )
        
        return await mint_collection_nft(
            self.agent,
            collection_mint,
            metadata,
            recipient
        )