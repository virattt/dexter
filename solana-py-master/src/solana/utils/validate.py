"""Validation utilities."""

from __future__ import annotations

from enum import IntEnum
from typing import Any

from solders.instruction import Instruction


def validate_instruction_keys(instruction: Instruction, expected: int) -> None:
    """Verify length of AccountMeta list of a transaction instruction is at least the expected length.

    Args:
        instruction: A Instruction object.
        expected: The expected length.
    """
    if len(instruction.accounts) < expected:
        raise ValueError(f"invalid instruction: found {len(instruction.accounts)} keys, expected at least {expected}")


def validate_instruction_type(parsed_data: Any, expected_type: IntEnum) -> None:
    """Check that the instruction type of the parsed data matches the expected instruction type.

    Args:
        parsed_data: Parsed instruction data object with `instruction_type` field.
        expected_type: The expected instruction type.
    """
    if parsed_data.instruction_type != expected_type:
        raise ValueError(
            f"invalid instruction; instruction index mismatch {parsed_data.instruction_type} != {expected_type}"
        )
