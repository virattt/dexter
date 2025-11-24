from typing import NotRequired, TypedDict, Optional, Dict, Union, Literal, Any
from solders.keypair import Keypair

class UnsupportedOperationException(Exception):
    """Exception raised when an operation is not supported by the wallet or service."""
    pass

SupportedToken = Literal[
    'ape', 'eth', 'matic', 'pol', 'sei', 'chz', 'avax', 'xai', 'fuel', 'vic',
    'ip', 'zcx', 'usdc', 'usdce', 'busd', 'usdxm', 'weth', 'degen', 'brett',
    'toshi', 'eurc', 'superverse', 'pirate', 'bonk', 'trump', 'fartcoin', 'giga',
    'moodeng', 'jailstool', 'wen', 'mlg', 'duo', 'pep', 'harambe', 'usedcar',
    'vine', 'fartboy', 'pnut', 'stonks', 'mew', 'baby', 'michi', 'butthole',
    'anglerfish', 'usa', 'chillguy', 'sigma', 'maneki', 'purpe', 'lockin', 'y2k',
    'fafo', 'nub', 'fullsend', 'shoggoth', 'mini', 'llm', 'sc', 'fatgf', 'pwease',
    'popcat', 'spx', 'fwog', 'mother', 'wif', 'fric', 'etf', 'gyat', 'bigballs',
    'goat', 'stupid', 'duko', 'bitcoin', 'buttcoin', 'mcdull', 'skbdi', 'elon4afd',
    'mumu', 'gme', 'biao', 'fred', 'pengu', 'asscoin', 'bhad', 'habibi', 'quant',
    'hammy', 'boden', 'dolan', 'nap', 'scf', 'titcoin', 'sol', 'ada', 'bnb', 'sui',
    'apt', 'sfuel'
]
TokenBalance = TypedDict('TokenBalance', {
    'token': SupportedToken,
    'decimals': int,
    'balances': Dict[str, Any],
})


class LinkedUser(TypedDict):
    """Type definition for a linked user."""
    email: NotRequired[str]
    phone: NotRequired[str]
    userId: NotRequired[int]


class TransactionApproval(TypedDict):
    """Type definition for a transaction approval."""
    signer: str
    signature: Optional[str]


class BaseFireblocksSigner(TypedDict):
    """Base type for Fireblocks-based signers."""
    type: Literal["solana-fireblocks-custodial",
                  "evm-fireblocks-custodial"]  # Add all possible values


class SolanaKeypairSigner(TypedDict):
    type: Literal["solana-keypair"]
    keyPair: Keypair


class SolanaFireblocksSigner(TypedDict):
    type: Literal["solana-fireblocks-custodial"]


class BaseWalletConfig(TypedDict):
    """Base configuration for any wallet type."""
    adminSigner: Union[SolanaKeypairSigner, SolanaFireblocksSigner]


class BaseWalletOptions(TypedDict):
    """Base options for any wallet type."""
    config: BaseWalletConfig
    linkedUser: Optional[LinkedUser]
