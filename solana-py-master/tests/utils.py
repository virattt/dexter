"""Integration test utils."""

from typing import get_args

from solders.rpc.responses import RPCError, RPCResult

from solana.rpc.commitment import Processed
from solana.rpc.types import TxOpts

AIRDROP_AMOUNT = 10_000_000_000

RPC_RESULT_TYPES = get_args(RPCResult)


def assert_valid_response(resp: RPCResult):
    """Assert valid RPCResult."""
    assert type(resp) in RPC_RESULT_TYPES
    assert not isinstance(resp, RPCError.__args__)  # type: ignore


OPTS = TxOpts(skip_confirmation=False, preflight_commitment=Processed)
