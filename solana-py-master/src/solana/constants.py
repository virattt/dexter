"""Solana constants."""

from solders.pubkey import Pubkey

LAMPORTS_PER_SOL: int = 1_000_000_000
"""Number of lamports per SOL, where 1 SOL equals 1 billion lamports."""

SYSTEM_PROGRAM_ID = Pubkey.from_string("11111111111111111111111111111111")
"""Program ID for the System Program."""

CONFIG_PROGRAM_ID: Pubkey = Pubkey.from_string("Config1111111111111111111111111111111111111")
"""Program ID for the Config Program."""

STAKE_PROGRAM_ID: Pubkey = Pubkey.from_string("Stake11111111111111111111111111111111111111")
"""Program ID for the Stake Program."""

VOTE_PROGRAM_ID: Pubkey = Pubkey.from_string("Vote111111111111111111111111111111111111111")
"""Program ID for the Vote Program."""

ADDRESS_LOOKUP_TABLE_PROGRAM_ID: Pubkey = Pubkey.from_string("AddressLookupTab1e1111111111111111111111111")
"""Program ID for the Address Lookup Table Program."""

BPF_LOADER_PROGRAM_ID: Pubkey = Pubkey.from_string("BPFLoaderUpgradeab1e11111111111111111111111")
"""Program ID for the BPF Loader Program."""

ED25519_PROGRAM_ID: Pubkey = Pubkey.from_string("Ed25519SigVerify111111111111111111111111111")
"""Program ID for the Ed25519 Program."""

SECP256K1_PROGRAM_ID: Pubkey = Pubkey.from_string("KeccakSecp256k11111111111111111111111111111")
"""Program ID for the Secp256k1 Program."""
