"""RPC types."""

from typing import NamedTuple, NewType, Optional

from solders.pubkey import Pubkey
from typing_extensions import TypedDict

from .commitment import Commitment, Finalized

URI = NewType("URI", str)
"""Type for endpoint URI."""

RPCMethod = NewType("RPCMethod", str)
"""Type for RPC method."""


class RPCError(TypedDict):
    """RPC error."""

    code: int
    """HTTP status code."""
    message: str
    """Error message."""


class DataSliceOpts(NamedTuple):
    """Option to limit the returned account data, only available for "base58" or "base64" encoding."""

    offset: int
    """Limit the returned account data using the provided offset: <usize>."""
    length: int
    """Limit the returned account data using the provided length: <usize>."""


class MemcmpOpts(NamedTuple):
    """Option to compare a provided series of bytes with program account data at a particular offset."""

    offset: int
    """Offset into program account data to start comparison: <usize>."""
    bytes: str
    """Data to match, as base-58 encoded string: <string>."""


class TokenAccountOpts(NamedTuple):
    """Options when querying token accounts.

    Provide one of mint or program_id.
    """

    mint: Optional[Pubkey] = None
    """Public key of the specific token Mint to limit accounts to."""
    program_id: Optional[Pubkey] = None
    """Public key of the Token program ID that owns the accounts."""
    encoding: str = "base64"
    """Encoding for Account data, either "base58" (slow) or "base64"."""
    data_slice: Optional[DataSliceOpts] = None
    """Option to limit the returned account data, only available for "base58" or "base64" encoding."""


class TxOpts(NamedTuple):
    """Options to specify when broadcasting a transaction."""

    skip_confirmation: bool = True
    """If false, `send_transaction` will try to confirm that the transaction was successfully broadcasted.

    When confirming a transaction, `send_transaction` will block for a maximum of 30 seconds. Wrap the call
    inside a thread to make it asynchronous.
    """
    skip_preflight: bool = False
    """If true, skip the preflight transaction checks."""
    preflight_commitment: Commitment = Finalized
    """Commitment level to use for preflight."""
    max_retries: Optional[int] = None
    """Maximum number of times for the RPC node to retry sending the transaction to the leader.
    If this parameter not provided, the RPC node will retry the transaction until it is finalized
    or until the blockhash expires.
    """
    last_valid_block_height: Optional[int] = None
    """Pass the latest valid block height here, to be consumed by confirm_transaction.
    Valid only if skip_confirmation is False.
    """
