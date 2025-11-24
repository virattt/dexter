from typing import Dict, List, Literal

from goat.types.token import Token as CoreToken

class Token(CoreToken):
    mintAddress: str

SolanaNetwork = Literal["mainnet", "devnet", "testnet"]

USDC: Token = {
    "name": "USD Coin",
    "symbol": "USDC",
    "decimals": 6,
    "mintAddress": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
}

USDT: Token = {
    "name": "Tether USD",
    "symbol": "USDT",
    "decimals": 6,
    "mintAddress": "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
}

BONK: Token = {
    "name": "Bonk",
    "symbol": "BONK",
    "decimals": 5,
    "mintAddress": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
}

USDC_DEVNET: Token = {
    "name": "USD Coin (Devnet)",
    "symbol": "USDC",
    "decimals": 6,
    "mintAddress": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
}

SPL_TOKENS: Dict[SolanaNetwork, List[Token]] = {
    "mainnet": [USDC, USDT, BONK],
    "devnet": [USDC_DEVNET],
    "testnet": [],
}
