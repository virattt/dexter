from typing import Any, Dict, Union, Optional
import base58
import base64
import json
from decimal import Decimal
from rsa import PublicKey
import logging

logger = logging.getLogger(__name__)

def decode_utf8(data: Union[str, bytes]) -> str:
    """
    Safely decode UTF-8 data.
    
    Args:
        data: Data to decode
        
    Returns:
        Decoded string
    """
    if isinstance(data, str):
        return data
    try:
        return data.decode('utf-8').rstrip('\x00')
    except UnicodeDecodeError:
        return base58.b58encode(data).decode('ascii')

def encode_bs58(data: Union[str, bytes]) -> str:
    """
    Encode data as base58.
    
    Args:
        data: Data to encode
        
    Returns:
        Base58 encoded string
    """
    if isinstance(data, str):
        data = data.encode()
    return base58.b58encode(data).decode('ascii')

def decode_bs58(data: str) -> bytes:
    """
    Decode base58 data.
    
    Args:
        data: Base58 string
        
    Returns:
        Decoded bytes
    """
    return base58.b58decode(data)

def to_json(data: Any) -> Dict[str, Any]:
    """
    Convert data to JSON-compatible format.
    
    Args:
        data: Data to convert
        
    Returns:
        JSON-compatible dictionary
    """
    if isinstance(data, str):
        try:
            return json.loads(data)
        except json.JSONDecodeError:
            return {"value": data}
    elif isinstance(data, (dict, list)):
        return json.loads(json.dumps(data, default=str))
    elif isinstance(data, PublicKey):
        return str(data)
    elif isinstance(data, Decimal):
        return float(data)
    elif isinstance(data, bytes):
        return base64.b64encode(data).decode('ascii')
    return data

def format_amount(
    amount: Union[int, float],
    decimals: int = 9
) -> float:
    """
    Format token amount with proper decimals.
    
    Args:
        amount: Raw amount
        decimals: Number of decimal places
        
    Returns:
        Formatted amount
    """
    return amount / (10 ** decimals)

def parse_amount(
    amount: Union[int, float, str],
    decimals: int = 9
) -> int:
    """
    Parse human-readable amount to raw value.
    
    Args:
        amount: Amount to parse
        decimals: Number of decimal places
        
    Returns:
        Raw amount integer
    """
    if isinstance(amount, str):
        amount = float(amount)
    return int(amount * (10 ** decimals))

def shorten_key(key: Union[str, PublicKey], chars: int = 4) -> str:
    """
    Shorten a public key for display.
    
    Args:
        key: Public key to shorten
        chars: Number of characters to show on each end
        
    Returns:
        Shortened key string
    """
    if isinstance(key, PublicKey):
        key = str(key)
    return f"{key[:chars]}...{key[-chars:]}"
