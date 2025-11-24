"""SPL token constants."""

from solders.pubkey import Pubkey

MINT_LEN: int = 82
"""Data length of a token mint account."""

ACCOUNT_LEN: int = 165
"""Data length of a token account."""

MULTISIG_LEN: int = 355
"""Data length of a multisig token account."""

ASSOCIATED_TOKEN_PROGRAM_ID = Pubkey.from_string("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
"""Program ID for the associated token account program."""

TOKEN_PROGRAM_ID: Pubkey = Pubkey.from_string("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
"""Public key that identifies the SPL token program."""

TOKEN_2022_PROGRAM_ID: Pubkey = Pubkey.from_string("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb")
"""Public key that identifies the SPL token 2022 program."""

WRAPPED_SOL_MINT: Pubkey = Pubkey.from_string("So11111111111111111111111111111111111111112")
"""Public key of the "Native Mint" for wrapping SOL to SPL token.

The Token Program can be used to wrap native SOL. Doing so allows native SOL to be treated like any
other Token program token type and can be useful when being called from other programs that interact
with the Token Program's interface.
"""

NATIVE_DECIMALS: int = 9
"""Number of decimals for SOL and the  Wrapped SOL mint."""
