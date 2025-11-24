"""Test sync client."""

from unittest.mock import patch

import pytest
from httpx import ReadTimeout
from solders.commitment_config import CommitmentLevel
from solders.pubkey import Pubkey
from solders.rpc.config import RpcSignaturesForAddressConfig
from solders.rpc.requests import GetSignaturesForAddress
from solders.signature import Signature

from solana.constants import SYSTEM_PROGRAM_ID
from solana.exceptions import SolanaRpcException
from solana.rpc.commitment import Finalized


def test_client_http_exception(unit_test_http_client):
    """Test AsyncClient raises native Solana-py exceptions."""
    with patch("httpx.post") as post_mock:
        post_mock.side_effect = ReadTimeout("placeholder")
        with pytest.raises(SolanaRpcException) as exc_info:
            unit_test_http_client.get_epoch_info()
        assert exc_info.type == SolanaRpcException
        assert exc_info.value.error_msg == "<class 'httpx.ConnectError'> raised in \"GetEpochInfo\" endpoint request"


def test_client_address_sig_args_no_commitment(unit_test_http_client):
    """Test generating getSignaturesForAddress body."""
    expected = GetSignaturesForAddress(
        SYSTEM_PROGRAM_ID,
        RpcSignaturesForAddressConfig(
            limit=5, before=Signature.default(), until=Signature.default(), commitment=CommitmentLevel.Processed
        ),
    )
    actual = unit_test_http_client._get_signatures_for_address_body(
        Pubkey([0] * 31 + [0]), before=Signature.default(), until=Signature.default(), limit=5, commitment=None
    )
    assert expected == actual


def test_client_address_sig_args_with_commitment(unit_test_http_client):
    expected = GetSignaturesForAddress(
        SYSTEM_PROGRAM_ID,
        RpcSignaturesForAddressConfig(limit=5, commitment=CommitmentLevel.Finalized),
    )
    actual = unit_test_http_client._get_signatures_for_address_body(Pubkey([0] * 31 + [0]), None, None, 5, Finalized)
    assert expected == actual
