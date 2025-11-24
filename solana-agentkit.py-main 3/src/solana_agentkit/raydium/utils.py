# raydium/utils.py

import json
import struct
import time
from typing import Optional, Tuple, Dict

import requests
from solana.rpc.async_api import AsyncClient
from solana.rpc.commitment import Confirmed, Processed
from solana.rpc.types import MemcmpOpts, TokenAccountOpts
from solders.instruction import Instruction # type: ignore
from solders.keypair import Keypair # type: ignore
from solders.pubkey import Pubkey as PublicKey # type: ignore
from solders.signature import Signature # type: ignore

from .constants import (
    OPEN_BOOK_PROGRAM,
    RAY_AUTHORITY_V4,
    RAY_V4,
    TOKEN_PROGRAM_ID,
    WSOL
)
from .layouts import (
    LIQUIDITY_STATE_LAYOUT_V4,
    MARKET_STATE_LAYOUT_V3,
    SWAP_LAYOUT
)
from .types import AccountMeta, PoolKeys

class RaydiumError(Exception):
    """Base exception for Raydium-related errors"""
    pass

async def fetch_pool_keys(client: AsyncClient, pair_address: str) -> Optional[PoolKeys]:
    """
    Fetch pool keys from a pair address
    
    Args:
        client: Solana RPC client
        pair_address: Pool pair address
        
    Returns:
        Pool keys or None if not found
    """
    try:
        amm_id = PublicKey.from_string(pair_address)
        amm_data = await client.get_account_info_json_parsed(amm_id, commitment=Processed)
        amm_data_decoded = LIQUIDITY_STATE_LAYOUT_V4.parse(amm_data)
        
        market_id = PublicKey.from_bytes(amm_data_decoded.serumMarket)
        market_info = await client.get_account_info_json_parsed(market_id, commitment=Processed)
        market_decoded = MARKET_STATE_LAYOUT_V3.parse(market_info)
        vault_signer_nonce = market_decoded.vault_signer_nonce

        return PoolKeys(
            amm_id=amm_id,
            base_mint=PublicKey.from_bytes(market_decoded.base_mint),
            quote_mint=PublicKey.from_bytes(market_decoded.quote_mint),
            base_decimals=amm_data_decoded.coinDecimals,
            quote_decimals=amm_data_decoded.pcDecimals,
            open_orders=PublicKey.from_bytes(amm_data_decoded.ammOpenOrders),
            target_orders=PublicKey.from_bytes(amm_data_decoded.ammTargetOrders),
            base_vault=PublicKey.from_bytes(amm_data_decoded.poolCoinTokenAccount),
            quote_vault=PublicKey.from_bytes(amm_data_decoded.poolPcTokenAccount),
            market_id=market_id,
            market_authority=PublicKey.create_program_address(
                [bytes(market_id), bytes_of(vault_signer_nonce)],
                OPEN_BOOK_PROGRAM
            ),
            market_base_vault=PublicKey.from_bytes(market_decoded.base_vault),
            market_quote_vault=PublicKey.from_bytes(market_decoded.quote_vault),
            bids=PublicKey.from_bytes(market_decoded.bids),
            asks=PublicKey.from_bytes(market_decoded.asks),
            event_queue=PublicKey.from_bytes(market_decoded.event_queue)
        )
    except Exception as e:
        raise RaydiumError(f"Error fetching pool keys: {str(e)}")

def get_pair_address_from_api(mint: str) -> Optional[str]:
    """
    Get pair address from Raydium API
    
    Args:
        mint: Token mint address
        
    Returns:
        Pair address or None if not found
    """
    url = f"https://api-v3.raydium.io/pools/info/mint?mint1={mint}&poolType=all&poolSortField=default&sortType=desc&pageSize=1&page=1"
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()

        pools = data.get('data', {}).get('data', [])
        if not pools:
            return None

        pool = pools[0]
        if pool.get('programId') == str(RAY_V4):
            return pool.get('id')
        return None
    except Exception:
        return None

async def get_pair_address_from_rpc(client: AsyncClient, token_address: str) -> Optional[str]:
    """
    Get pair address from RPC node
    
    Args:
        client: Solana RPC client
        token_address: Token address to find pair for
        
    Returns:
        Pair address or None if not found
    """
    try:
        BASE_OFFSET = 400
        QUOTE_OFFSET = 432
        DATA_LENGTH_FILTER = 752
        QUOTE_MINT = str(WSOL)

        async def fetch_amm_id(base_mint: str, quote_mint: str) -> Optional[str]:
            try:
                response = await client.get_program_accounts(
                    RAY_V4,
                    commitment=Processed,
                    filters=[
                        DATA_LENGTH_FILTER,
                        MemcmpOpts(offset=BASE_OFFSET, bytes=base_mint),
                        MemcmpOpts(offset=QUOTE_OFFSET, bytes=quote_mint)
                    ]
                )
                accounts = response.value
                return str(accounts[0].pubkey) if accounts else None
            except Exception:
                return None

        # Try both directions (token/WSOL and WSOL/token)
        pair_address = await fetch_amm_id(token_address, QUOTE_MINT)
        if not pair_address:
            pair_address = await fetch_amm_id(QUOTE_MINT, token_address)

        return pair_address
    except Exception as e:
        raise RaydiumError(f"Error fetching pair address: {str(e)}")

def make_swap_instruction(
    amount_in: int,
    minimum_amount_out: int,
    token_account_in: PublicKey,
    token_account_out: PublicKey,
    accounts: PoolKeys,
    owner: Keypair
) -> Instruction:
    """
    Create swap instruction
    
    Args:
        amount_in: Input amount
        minimum_amount_out: Minimum output amount
        token_account_in: Input token account
        token_account_out: Output token account
        accounts: Pool keys
        owner: Transaction signer
        
    Returns:
        Swap instruction
    """
    try:
        keys = [
            AccountMeta(pubkey=TOKEN_PROGRAM_ID, is_signer=False, is_writable=False),
            AccountMeta(pubkey=accounts.amm_id, is_signer=False, is_writable=True),
            AccountMeta(pubkey=RAY_AUTHORITY_V4, is_signer=False, is_writable=False),
            AccountMeta(pubkey=accounts.open_orders, is_signer=False, is_writable=True),
            AccountMeta(pubkey=accounts.target_orders, is_signer=False, is_writable=True),
            AccountMeta(pubkey=accounts.base_vault, is_signer=False, is_writable=True),
            AccountMeta(pubkey=accounts.quote_vault, is_signer=False, is_writable=True),
            AccountMeta(pubkey=OPEN_BOOK_PROGRAM, is_signer=False, is_writable=False),
            AccountMeta(pubkey=accounts.market_id, is_signer=False, is_writable=True),
            AccountMeta(pubkey=accounts.bids, is_signer=False, is_writable=True),
            AccountMeta(pubkey=accounts.asks, is_signer=False, is_writable=True),
            AccountMeta(pubkey=accounts.event_queue, is_signer=False, is_writable=True),
            AccountMeta(pubkey=accounts.market_base_vault, is_signer=False, is_writable=True),
            AccountMeta(pubkey=accounts.market_quote_vault, is_signer=False, is_writable=True),
            AccountMeta(pubkey=accounts.market_authority, is_signer=False, is_writable=False),
            AccountMeta(pubkey=token_account_in, is_signer=False, is_writable=True),
            AccountMeta(pubkey=token_account_out, is_signer=False, is_writable=True),
            AccountMeta(pubkey=owner.pubkey(), is_signer=True, is_writable=False)
        ]

        data = SWAP_LAYOUT.build({
            "instruction": 9,
            "amount_in": amount_in,
            "min_amount_out": minimum_amount_out
        })

        return Instruction(RAY_V4, data, keys)
    except Exception as e:
        raise RaydiumError(f"Error creating swap instruction: {str(e)}")

async def get_token_reserves(
    client: AsyncClient,
    pool_keys: PoolKeys
) -> Tuple[Optional[float], Optional[float], Optional[int]]:
    """
    Get token reserves from pool
    
    Args:
        client: Solana RPC client
        pool_keys: Pool keys
        
    Returns:
        Tuple of (base_reserve, quote_reserve, token_decimal)
    """
    try:
        balances = await client.get_multiple_accounts_json_parsed(
            [pool_keys.base_vault, pool_keys.quote_vault],
            Processed
        )

        token_account = balances.value[0]
        sol_account = balances.value[1]

        token_balance = token_account.data.parsed['info']['tokenAmount']['uiAmount']
        sol_balance = sol_account.data.parsed['info']['tokenAmount']['uiAmount']

        if token_balance is None or sol_balance is None:
            return None, None, None

        if pool_keys.base_mint == WSOL:
            return (
                sol_balance,
                token_balance,
                pool_keys.quote_decimals
            )
        else:
            return (
                token_balance,
                sol_balance,
                pool_keys.base_decimals
            )

    except Exception as e:
        raise RaydiumError(f"Error fetching token reserves: {str(e)}")

def calculate_swap_amounts(
    amount_in: float,
    reserves_in: float,
    reserves_out: float,
    swap_fee: float = 0.25
) -> Dict[str, float]:
    """
    Calculate swap output amounts
    
    Args:
        amount_in: Input amount
        reserves_in: Input token reserves
        reserves_out: Output token reserves
        swap_fee: Swap fee percentage
        
    Returns:
        Dict containing amounts and impact
    """
    try:
        fee_adjusted_amount = amount_in * (1 - (swap_fee / 100))
        constant_product = reserves_in * reserves_out
        new_reserves_in = reserves_in + fee_adjusted_amount
        new_reserves_out = constant_product / new_reserves_in
        amount_out = reserves_out - new_reserves_out
        
        # Calculate price impact
        price_impact = abs((new_reserves_out / new_reserves_in) - 
                         (reserves_out / reserves_in)) / (reserves_out / reserves_in) * 100

        return {
            "amount_out": amount_out,
            "fee_amount": amount_in * (swap_fee / 100),
            "price_impact": price_impact
        }
    except Exception as e:
        raise RaydiumError(f"Error calculating swap amounts: {str(e)}")

def bytes_of(value: int) -> bytes:
    """Convert integer to bytes"""
    if not (0 <= value < 2**64):
        raise ValueError("Value must be in range of u64")
    return struct.pack('<Q', value)

async def confirm_transaction(
    client: AsyncClient,
    signature: Signature,
    max_retries: int = 20,
    retry_interval: int = 3
) -> bool:
    """
    Confirm transaction success
    
    Args:
        client: Solana RPC client
        signature: Transaction signature
        max_retries: Maximum retry attempts
        retry_interval: Seconds between retries
        
    Returns:
        True if confirmed, False otherwise
    """
    for retry in range(max_retries):
        try:
            response = await client.get_transaction(
                signature,
                encoding="json",
                commitment=Confirmed,
                max_supported_transaction_version=0
            )
            
            if response.value.transaction.meta.err is None:
                return True
                
            if response.value.transaction.meta.err:
                return False
                
        except Exception:
            if retry < max_retries - 1:
                time.sleep(retry_interval)
                continue
            else:
                return False
    
    return False