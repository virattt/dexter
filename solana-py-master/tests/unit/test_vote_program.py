"""Unit tests for solana.vote_program."""

import base64

from solders.hash import Hash
from solders.keypair import Keypair
from solders.message import Message
from solders.pubkey import Pubkey
import solana.vote_program as vp


def test_withdraw_from_vote_account():
    withdrawer_keypair = Keypair.from_bytes(
        [
            134,
            123,
            27,
            208,
            227,
            175,
            253,
            99,
            4,
            81,
            170,
            231,
            186,
            141,
            177,
            142,
            197,
            139,
            94,
            6,
            157,
            2,
            163,
            89,
            150,
            121,
            235,
            86,
            185,
            22,
            1,
            233,
            58,
            133,
            229,
            39,
            212,
            71,
            254,
            72,
            246,
            45,
            160,
            156,
            129,
            199,
            18,
            189,
            53,
            143,
            98,
            72,
            182,
            106,
            69,
            29,
            38,
            145,
            119,
            190,
            13,
            105,
            157,
            112,
        ]
    )
    vote_account_pubkey = Pubkey.from_string("CWqJy1JpmBcx7awpeANfrPk6AsQKkmego8ujjaYPGFEk")
    receiver_account_pubkey = Pubkey.from_string("A1V5gsis39WY42djdTKUFsgE5oamk4nrtg16WnKTuzZK")
    recent_blockhash = Hash.from_string("Add1tV7kJgNHhTtx3Dgs6dhC7kyXrGJQZ2tJGW15tLDH")
    msg = Message.new_with_blockhash(
        [
            vp.withdraw_from_vote_account(
                vp.WithdrawFromVoteAccountParams(
                    vote_account_from_pubkey=vote_account_pubkey,
                    to_pubkey=receiver_account_pubkey,
                    withdrawer=withdrawer_keypair.pubkey(),
                    lamports=2_000_000_000,
                )
            )
        ],
        withdrawer_keypair.pubkey(),
        recent_blockhash,
    )

    # solana withdraw-from-vote-account --dump-transaction-message \
    #   CWqJy1JpmBcx7awpeANfrPk6AsQKkmego8ujjaYPGFEk A1V5gsis39WY42djdTKUFsgE5oamk4nrtg16WnKTuzZK \
    # --authorized-withdrawer withdrawer.json \
    # 2 \
    # --blockhash Add1tV7kJgNHhTtx3Dgs6dhC7kyXrGJQZ2tJGW15tLDH \
    # --sign-only -k withdrawer.json
    cli_wire_msg = base64.b64decode(  # noqa: F841
        b"AQABBDqF5SfUR/5I9i2gnIHHEr01j2JItmpFHSaRd74NaZ1wqxUGDtH5ah3TqEKWjcTmfHkpZC1h57NJL8Sx7Q6Olm2F2O70oOvzt1HgIVu+nySaSrWtJiK1eDacPPDWRxCwFgdhSB01dHS7fE12JOvTvbPYNV5z0RBD/A2jU4AAAAAAjxrQaMS7FjmaR++mvFr3XE6XbzMUTMJUIpITrUWBzGwBAwMBAgAMAwAAAACUNXcAAAAA"
    )
    js_wire_msg = base64.b64decode(
        b"AQABBDqF5SfUR/5I9i2gnIHHEr01j2JItmpFHSaRd74NaZ1whdju9KDr87dR4CFbvp8kmkq1rSYitXg2nDzw1kcQsBarFQYO0flqHdOoQpaNxOZ8eSlkLWHns0kvxLHtDo6WbQdhSB01dHS7fE12JOvTvbPYNV5z0RBD/A2jU4AAAAAAjxrQaMS7FjmaR++mvFr3XE6XbzMUTMJUIpITrUWBzGwBAwMCAQAMAwAAAACUNXcAAAAA"
    )

    serialized_message = bytes(msg)

    assert serialized_message == js_wire_msg
    # XXX:  Cli message serialization do not sort on account metas producing discrepency
    # serialized_message txn == cli_wire_msg
