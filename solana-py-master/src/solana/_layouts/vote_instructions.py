"""Byte layouts for vote program instructions."""

from enum import IntEnum

from construct import (
    Int32ul,
    Int64ul,
    Switch,  # type: ignore
)
from construct import Struct as cStruct


class InstructionType(IntEnum):
    """Instruction types for vote program."""

    WITHDRAW_FROM_VOTE_ACCOUNT = 3


_WITHDRAW_FROM_VOTE_ACCOUNT_LAYOUT = cStruct("lamports" / Int64ul)

VOTE_INSTRUCTIONS_LAYOUT = cStruct(
    "instruction_type" / Int32ul,
    "args"
    / Switch(
        lambda this: this.instruction_type,
        {
            InstructionType.WITHDRAW_FROM_VOTE_ACCOUNT: _WITHDRAW_FROM_VOTE_ACCOUNT_LAYOUT,
        },
    ),
)
