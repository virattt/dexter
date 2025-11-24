"""Tests for the Memo program."""

import pytest
from solders.keypair import Keypair
from solders.message import Message
from solders.transaction_status import ParsedInstruction
from spl.memo.constants import MEMO_PROGRAM_ID
from spl.memo.instructions import MemoParams, create_memo

from solana.rpc.api import Client
from solana.rpc.commitment import Finalized
from solders.transaction import Transaction

from ..utils import AIRDROP_AMOUNT, assert_valid_response


@pytest.mark.integration
def test_send_memo_in_transaction(stubbed_sender: Keypair, test_http_client: Client):
    """Test sending a memo instruction to localnet."""
    airdrop_resp = test_http_client.request_airdrop(stubbed_sender.pubkey(), AIRDROP_AMOUNT)
    assert_valid_response(airdrop_resp)
    test_http_client.confirm_transaction(airdrop_resp.value)
    raw_message = "test"
    message = bytes(raw_message, encoding="utf8")
    # Create memo params
    memo_params = MemoParams(
        program_id=MEMO_PROGRAM_ID,
        signer=stubbed_sender.pubkey(),
        message=message,
    )
    # Create transfer tx to add memo to transaction from stubbed sender
    blockhash = test_http_client.get_latest_blockhash().value.blockhash
    ixs = [create_memo(memo_params)]
    msg = Message.new_with_blockhash(ixs, stubbed_sender.pubkey(), blockhash)
    transfer_tx = Transaction([stubbed_sender], msg, blockhash)
    resp = test_http_client.send_transaction(transfer_tx)
    assert_valid_response(resp)
    txn_id = resp.value
    # Txn needs to be finalized in order to parse the logs.
    test_http_client.confirm_transaction(txn_id, commitment=Finalized)
    resp2_val = test_http_client.get_transaction(txn_id, commitment=Finalized, encoding="jsonParsed").value
    assert resp2_val is not None
    resp2_transaction = resp2_val.transaction
    meta = resp2_transaction.meta
    assert meta is not None
    messages = meta.log_messages
    assert messages is not None
    log_message = messages[2].split('"')
    assert log_message[1] == raw_message
    ixn = resp2_transaction.transaction.message.instructions[0]
    assert isinstance(ixn, ParsedInstruction)
    assert ixn.parsed == raw_message
    assert ixn.program_id == MEMO_PROGRAM_ID
