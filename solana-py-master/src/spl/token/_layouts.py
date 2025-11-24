"""Token instruction layouts."""

from enum import IntEnum

from construct import Bytes, Int8ul, Int32ul, Int64ul, Pass, Switch
from construct import Struct as cStruct

PUBLIC_KEY_LAYOUT = Bytes(32)


class InstructionType(IntEnum):
    """Token instruction types."""

    INITIALIZE_MINT = 0
    INITIALIZE_ACCOUNT = 1
    INITIALIZE_MULTISIG = 2
    TRANSFER = 3
    APPROVE = 4
    REVOKE = 5
    SET_AUTHORITY = 6
    MINT_TO = 7
    BURN = 8
    CLOSE_ACCOUNT = 9
    FREEZE_ACCOUNT = 10
    THAW_ACCOUNT = 11
    TRANSFER2 = 12
    APPROVE2 = 13
    MINT_TO2 = 14
    BURN2 = 15
    SYNC_NATIVE = 17


_INITIALIZE_MINT_LAYOUT = cStruct(
    "decimals" / Int8ul,
    "mint_authority" / PUBLIC_KEY_LAYOUT,
    "freeze_authority_option" / Int8ul,
    "freeze_authority" / PUBLIC_KEY_LAYOUT,
)

_INITIALIZE_MULTISIG_LAYOUT = cStruct("m" / Int8ul)

_AMOUNT_LAYOUT = cStruct("amount" / Int64ul)

_SET_AUTHORITY_LAYOUT = cStruct(
    "authority_type" / Int8ul,
    "new_authority_option" / Int8ul,
    "new_authority" / PUBLIC_KEY_LAYOUT,
)

_AMOUNT2_LAYOUT = cStruct("amount" / Int64ul, "decimals" / Int8ul)

INSTRUCTIONS_LAYOUT = cStruct(
    "instruction_type" / Int8ul,
    "args"
    / Switch(
        lambda this: this.instruction_type,
        {
            InstructionType.INITIALIZE_MINT: _INITIALIZE_MINT_LAYOUT,
            InstructionType.INITIALIZE_ACCOUNT: Pass,
            InstructionType.INITIALIZE_MULTISIG: _INITIALIZE_MULTISIG_LAYOUT,
            InstructionType.TRANSFER: _AMOUNT_LAYOUT,
            InstructionType.APPROVE: _AMOUNT_LAYOUT,
            InstructionType.REVOKE: Pass,
            InstructionType.SET_AUTHORITY: _SET_AUTHORITY_LAYOUT,
            InstructionType.MINT_TO: _AMOUNT_LAYOUT,
            InstructionType.BURN: _AMOUNT_LAYOUT,
            InstructionType.CLOSE_ACCOUNT: Pass,
            InstructionType.FREEZE_ACCOUNT: Pass,
            InstructionType.THAW_ACCOUNT: Pass,
            InstructionType.TRANSFER2: _AMOUNT2_LAYOUT,
            InstructionType.APPROVE2: _AMOUNT2_LAYOUT,
            InstructionType.MINT_TO2: _AMOUNT2_LAYOUT,
            InstructionType.BURN2: _AMOUNT2_LAYOUT,
        },
    ),
)

MINT_LAYOUT = cStruct(
    "mint_authority_option" / Int32ul,
    "mint_authority" / PUBLIC_KEY_LAYOUT,
    "supply" / Int64ul,
    "decimals" / Int8ul,
    "is_initialized" / Int8ul,
    "freeze_authority_option" / Int32ul,
    "freeze_authority" / PUBLIC_KEY_LAYOUT,
)

ACCOUNT_LAYOUT = cStruct(
    "mint" / PUBLIC_KEY_LAYOUT,
    "owner" / PUBLIC_KEY_LAYOUT,
    "amount" / Int64ul,
    "delegate_option" / Int32ul,
    "delegate" / PUBLIC_KEY_LAYOUT,
    "state" / Int8ul,
    "is_native_option" / Int32ul,
    "is_native" / Int64ul,
    "delegated_amount" / Int64ul,
    "close_authority_option" / Int32ul,
    "close_authority" / PUBLIC_KEY_LAYOUT,
)

MULTISIG_LAYOUT = cStruct(
    "m" / Int8ul,
    "n" / Int8ul,
    "is_initialized" / Int8ul,
    "signer1" / PUBLIC_KEY_LAYOUT,
    "signer2" / PUBLIC_KEY_LAYOUT,
    "signer3" / PUBLIC_KEY_LAYOUT,
    "signer4" / PUBLIC_KEY_LAYOUT,
    "signer5" / PUBLIC_KEY_LAYOUT,
    "signer6" / PUBLIC_KEY_LAYOUT,
    "signer7" / PUBLIC_KEY_LAYOUT,
    "signer8" / PUBLIC_KEY_LAYOUT,
    "signer9" / PUBLIC_KEY_LAYOUT,
    "signer10" / PUBLIC_KEY_LAYOUT,
    "signer11" / PUBLIC_KEY_LAYOUT,
)
