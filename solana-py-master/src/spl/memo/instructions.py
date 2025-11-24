"""Memo program instructions."""

from __future__ import annotations

from typing import NamedTuple

from solders.instruction import AccountMeta, Instruction
from solders.pubkey import Pubkey


class MemoParams(NamedTuple):
    """Create memo transaction params."""

    program_id: Pubkey
    """Memo program account."""
    signer: Pubkey
    """Signing account."""
    message: bytes
    """Memo message in bytes."""


def decode_create_memo(instruction: Instruction) -> MemoParams:
    """Decode a create_memo_instruction and retrieve the instruction params.

    Args:
        instruction: The instruction to decode.

    Returns:
        The decoded instruction.
    """
    return MemoParams(
        signer=instruction.accounts[0].pubkey,
        message=instruction.data,
        program_id=instruction.program_id,
    )


def create_memo(params: MemoParams) -> Instruction:
    """Creates a transaction instruction that creates a memo.

    Message need to be encoded in bytes.

    Example:
        >>> from solders.pubkey import Pubkey
        >>> leading_zeros = [0] * 31
        >>> signer, memo_program = Pubkey(leading_zeros + [1]), Pubkey(leading_zeros + [2])
        >>> message = bytes("test", encoding="utf8")
        >>> params = MemoParams(
        ...     program_id=memo_program,
        ...     message=message,
        ...     signer=signer
        ... )
        >>> type(create_memo(params))
        <class 'solders.instruction.Instruction'>

    Returns:
        The instruction to create a memo.
    """
    keys = [
        AccountMeta(pubkey=params.signer, is_signer=True, is_writable=True),
    ]
    return Instruction(
        accounts=keys,
        program_id=params.program_id,
        data=params.message,
    )
