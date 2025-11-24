# src/solana_agentkit/tools/launch_pumpfun_token.py

from typing import Optional, Dict, Any
from dataclasses import dataclass
from solana.rpc.commitment import Confirmed
from solana.transaction import VersionedTransaction
import aiohttp
import json
import base64
from pathlib import Path
import logging

from solana_agentkit.agent.solana_agent import SolanaAgent
from solana_agentkit.utils import keypair

logger = logging.getLogger(__name__)

@dataclass
class PumpFunTokenOptions:
    """Options for launching a token on Pump.fun."""
    twitter: Optional[str] = None
    telegram: Optional[str] = None
    website: Optional[str] = None
    initial_liquidity_sol: float = 0.0001
    slippage_bps: int = 5
    priority_fee: float = 0.00005

@dataclass
class TokenLaunchResult:
    """Result of a token launch operation."""
    signature: str
    mint: str
    metadata_uri: str

async def upload_metadata(
    token_name: str,
    token_ticker: str,
    description: str,
    image_url: str,
    options: Optional[PumpFunTokenOptions] = None
) -> Dict[str, Any]:
    """
    Upload token metadata and image to IPFS via Pump.fun.
    
    Args:
        token_name: Name of the token
        token_ticker: Token symbol/ticker
        description: Token description
        image_url: URL of token image
        options: Optional token configuration
        
    Returns:
        Dictionary containing metadata response from server
    """
    async with aiohttp.ClientSession() as session:
        # Create form data
        form_data = aiohttp.FormData()
        form_data.add_field('name', token_name)
        form_data.add_field('symbol', token_ticker)
        form_data.add_field('description', description)
        form_data.add_field('showName', 'true')
        
        # Add optional fields
        if options:
            if options.twitter:
                form_data.add_field('twitter', options.twitter)
            if options.telegram:
                form_data.add_field('telegram', options.telegram)
            if options.website:
                form_data.add_field('website', options.website)

        # Download and add image
        async with session.get(image_url) as image_response:
            if image_response.status != 200:
                raise Exception(f"Failed to download image from {image_url}")
            image_data = await image_response.read()
            form_data.add_field(
                'file',
                image_data,
                filename='token_image.png',
                content_type='image/png'
            )

        # Upload to Pump.fun
        async with session.post(
            "https://pump.fun/api/ipfs",
            data=form_data
        ) as response:
            if response.status != 200:
                error_text = await response.text()
                raise Exception(f"Metadata upload failed: {error_text}")
                
            return await response.json()

async def create_token_transaction(
    agent: 'SolanaAgent',
    mint_keypair: keypair,
    metadata_response: Dict[str, Any],
    options: Optional[PumpFunTokenOptions] = None
) -> bytes:
    """
    Create token transaction through Pump.fun API.
    
    Args:
        agent: SolanaAgentKit instance
        mint_keypair: Keypair for the token mint
        metadata_response: Response from metadata upload
        options: Optional token configuration
        
    Returns:
        Serialized transaction bytes
    """
    options = options or PumpFunTokenOptions()
    
    payload = {
        "publicKey": str(agent.wallet_address),
        "action": "create",
        "tokenMetadata": {
            "name": metadata_response["metadata"]["name"],
            "symbol": metadata_response["metadata"]["symbol"],
            "uri": metadata_response["metadataUri"],
        },
        "mint": str(mint_keypair.public_key),
        "denominatedInSol": "true",
        "amount": options.initial_liquidity_sol,
        "slippage": options.slippage_bps,
        "priorityFee": options.priority_fee,
        "pool": "pump"
    }

    async with aiohttp.ClientSession() as session:
        async with session.post(
            "https://pumpportal.fun/api/trade-local",
            json=payload
        ) as response:
            if response.status != 200:
                error_text = await response.text()
                raise Exception(f"Transaction creation failed: {error_text}")
                
            return await response.read()

async def sign_and_send_transaction(
    agent: 'SolanaAgent',
    tx: VersionedTransaction,
    mint_keypair: keypair
) -> str:
    """
    Sign and send transaction with proper error handling.
    
    Args:
        agent: SolanaAgentKit instance
        tx: Transaction to send
        mint_keypair: Keypair for the token mint
        
    Returns:
        Transaction signature
    """
    try:
        # Get latest blockhash
        recent_blockhash = await agent.connection.get_latest_blockhash()
        
        # Update transaction
        tx.message.recent_blockhash = recent_blockhash.value.blockhash
        
        # Sign transaction
        tx.sign([mint_keypair, agent.wallet])
        
        # Send transaction
        signature = await agent.connection.send_transaction(
            tx,
            [agent.wallet, mint_keypair],
            opts={
                "skip_preflight": False,
                "preflight_commitment": Confirmed,
                "max_retries": 5
            }
        )
        
        # Wait for confirmation
        confirmation = await agent.connection.confirm_transaction(
            signature,
            commitment=Confirmed
        )
        
        if confirmation.value.err:
            raise Exception(f"Transaction failed: {confirmation.value.err}")
            
        return str(signature)
        
    except Exception as error:
        logger.error(f"Transaction error: {error}")
        raise

async def launch_pumpfun_token(
    agent: 'SolanaAgent',
    token_name: str,
    token_ticker: str,
    description: str,
    image_url: str,
    options: Optional[PumpFunTokenOptions] = None
) -> TokenLaunchResult:
    """
    Launch a new token on Pump.fun.
    
    Args:
        agent: SolanaAgentKit instance
        token_name: Name of the token
        token_ticker: Token symbol/ticker
        description: Token description
        image_url: URL of token image
        options: Optional token configuration
        
    Returns:
        TokenLaunchResult containing transaction signature, mint address, and metadata URI
    """
    try:
        logger.info("Starting token launch process...")
        
        # Generate mint keypair
        mint_keypair = keypair()
        logger.info(f"Mint public key: {mint_keypair.public_key}")
        
        # Upload metadata
        logger.info("Uploading metadata to IPFS...")
        metadata_response = await upload_metadata(
            token_name,
            token_ticker,
            description,
            image_url,
            options
        )
        logger.info(f"Metadata response: {metadata_response}")
        
        # Create transaction
        logger.info("Creating token transaction...")
        tx_data = await create_token_transaction(
            agent,
            mint_keypair,
            metadata_response,
            options
        )
        tx = VersionedTransaction.deserialize(tx_data)
        
        # Send transaction
        logger.info("Sending transaction...")
        signature = await sign_and_send_transaction(agent, tx, mint_keypair)
        
        logger.info("Token launch successful!")
        return TokenLaunchResult(
            signature=signature,
            mint=str(mint_keypair.public_key),
            metadata_uri=metadata_response["metadataUri"]
        )
        
    except Exception as error:
        logger.error(f"Error in launch_pumpfun_token: {error}")
        raise