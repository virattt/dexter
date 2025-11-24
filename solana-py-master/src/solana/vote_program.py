"""Library to interface with the vote program."""

from __future__ import annotations

from typing import NamedTuple

from solders.instruction import AccountMeta, Instruction
from solders.pubkey import Pubkey

from solana.constants import VOTE_PROGRAM_ID
from solana._layouts.vote_instructions import VOTE_INSTRUCTIONS_LAYOUT, InstructionType


# Instrection Params
class WithdrawFromVoteAccountParams(NamedTuple):
    """Transfer SOL from vote account to identity."""

    vote_account_from_pubkey: Pubkey
    """"""
    to_pubkey: Pubkey
    """"""
    lamports: int
    """"""
    withdrawer: Pubkey
    """"""


def withdraw_from_vote_account(params: WithdrawFromVoteAccountParams) -> Instruction:
    """Generate an instruction that transfers lamports from a vote account to any other.

    Example:
        >>> from solders.pubkey import Pubkey
        >>> from solders.keypair import Keypair
        >>> vote = Pubkey([0] * 31 + [1])
        >>> withdrawer = Keypair.from_seed(bytes([0]*32))
        >>> instruction = withdraw_from_vote_account(
        ...    WithdrawFromVoteAccountParams(
        ...        vote_account_from_pubkey=vote,
        ...        to_pubkey=withdrawer.pubkey(),
        ...        withdrawer=withdrawer.pubkey(),
        ...        lamports=3_000_000_000,
        ...    )
        ... )
        >>> type(instruction)
        <class 'solders.instruction.Instruction'>

    Returns:
        The generated instruction.
    """
    data = VOTE_INSTRUCTIONS_LAYOUT.build(
        {
            "instruction_type": InstructionType.WITHDRAW_FROM_VOTE_ACCOUNT,
            "args": {"lamports": params.lamports},
        }
    )

    return Instruction(
        accounts=[
            AccountMeta(
                pubkey=params.vote_account_from_pubkey,
                is_signer=False,
                is_writable=True,
            ),
            AccountMeta(pubkey=params.to_pubkey, is_signer=False, is_writable=True),
            AccountMeta(pubkey=params.withdrawer, is_signer=True, is_writable=True),
        ],
        program_id=VOTE_PROGRAM_ID,
        data=data,
    )
