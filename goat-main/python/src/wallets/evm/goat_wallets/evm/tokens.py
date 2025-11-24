from typing import Dict, List, TypedDict, Literal, Optional

from goat.types.token import Token as CoreToken

class TokenChainInfo(TypedDict):
    contractAddress: str

class Token(CoreToken):
    chains: Dict[int, TokenChainInfo]  # chain_id -> token info

USDC: Token = {
    "name": "USD Coin",
    "symbol": "USDC",
    "decimals": 6,
    "chains": {
        1: {"contractAddress": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"},
        42161: {"contractAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"},
        10: {"contractAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85"},
        8453: {"contractAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"},
        11155111: {"contractAddress": "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"},
    },
}

PEPE: Token = {
    "name": "Pepe",
    "symbol": "PEPE",
    "decimals": 18,
    "chains": {
        1: {"contractAddress": "0x6982508145454Ce325dDbE47a25d4ec3d2311933"},
        11155111: {"contractAddress": "0x6982508145454Ce325dDbE47a25d4ec3d2311933"},
    },
}

PREDEFINED_TOKENS: List[Token] = [USDC, PEPE]
