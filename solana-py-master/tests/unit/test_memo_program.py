from solders.keypair import Keypair
from spl.memo.constants import MEMO_PROGRAM_ID
from spl.memo.instructions import MemoParams, create_memo, decode_create_memo


def test_memo():
    """Test creating a memo instruction."""
    params = MemoParams(signer=Keypair().pubkey(), message=b"test", program_id=MEMO_PROGRAM_ID)
    assert decode_create_memo(create_memo(params)) == params
