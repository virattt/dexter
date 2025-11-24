"""SPL token instructions."""  # pylint: disable=too-many-lines

from enum import IntEnum
from typing import Any, List, NamedTuple, Optional, Union

from solders.instruction import AccountMeta, Instruction
from solders.pubkey import Pubkey
from solders.system_program import ID as SYS_PROGRAM_ID
from solders.sysvar import RENT

from solana.utils.validate import validate_instruction_keys, validate_instruction_type
from spl.token._layouts import INSTRUCTIONS_LAYOUT, InstructionType
from spl.token.constants import ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID


class AuthorityType(IntEnum):
    """Specifies the authority type for SetAuthority instructions."""

    MINT_TOKENS = 0
    """"Authority to mint new tokens."""
    FREEZE_ACCOUNT = 1
    """Authority to freeze any account associated with the Mint."""
    ACCOUNT_OWNER = 2
    """Owner of a given token account."""
    CLOSE_ACCOUNT = 3
    """Authority to close a token account."""


# Instruction Params
class InitializeMintParams(NamedTuple):
    """Initialize token mint transaction params."""

    decimals: int
    """Number of base 10 digits to the right of the decimal place."""
    program_id: Pubkey
    """SPL Token program account."""
    mint: Pubkey
    """Public key of the minter account."""
    mint_authority: Pubkey
    """The authority/multisignature to mint tokens."""
    freeze_authority: Optional[Pubkey] = None
    """The freeze authority/multisignature of the mint."""


class InitializeAccountParams(NamedTuple):
    """Initialize token account transaction params."""

    program_id: Pubkey
    """SPL Token program account."""
    account: Pubkey
    """Public key of the new account."""
    mint: Pubkey
    """Public key of the minter account."""
    owner: Pubkey
    """Owner of the new account."""


class InitializeMultisigParams(NamedTuple):
    """Initialize multisig token account transaction params."""

    program_id: Pubkey
    """SPL Token program account."""
    multisig: Pubkey
    """New multisig account address."""
    m: int
    """The number of signers (M) required to validate this multisignature account."""
    signers: List[Pubkey] = []
    """Addresses of multisig signers."""


class TransferParams(NamedTuple):
    """Transfer token transaction params."""

    program_id: Pubkey
    """SPL Token program account."""
    source: Pubkey
    """Source account."""
    dest: Pubkey
    """Destination account."""
    owner: Pubkey
    """Owner of the source account."""
    amount: int
    """Number of tokens to transfer."""
    signers: List[Pubkey] = []
    """Signing accounts if `owner` is a multiSig."""


class ApproveParams(NamedTuple):
    """Approve token transaction params."""

    program_id: Pubkey
    """SPL Token program account."""
    source: Pubkey
    """Source account."""
    delegate: Pubkey
    """Delegate account authorized to perform a transfer of tokens from the source account."""
    owner: Pubkey
    """Owner of the source account."""
    amount: int
    """Maximum number of tokens the delegate may transfer."""
    signers: List[Pubkey] = []
    """Signing accounts if `owner` is a multiSig."""


class RevokeParams(NamedTuple):
    """Revoke token transaction params."""

    program_id: Pubkey
    """SPL Token program account."""
    account: Pubkey
    """Source account for which transfer authority is being revoked."""
    owner: Pubkey
    """Owner of the source account."""
    signers: List[Pubkey] = []
    """Signing accounts if `owner` is a multiSig."""


class SetAuthorityParams(NamedTuple):
    """Set token authority transaction params."""

    program_id: Pubkey
    """SPL Token program account."""
    account: Pubkey
    """Public key of the token account."""
    authority: AuthorityType
    """The type of authority to update."""
    current_authority: Pubkey
    """Current authority of the specified type."""
    signers: List[Pubkey] = []
    """Signing accounts if `current_authority` is a multiSig."""
    new_authority: Optional[Pubkey] = None
    """New authority of the account."""


class MintToParams(NamedTuple):
    """Mint token transaction params."""

    program_id: Pubkey
    """SPL Token program account."""
    mint: Pubkey
    """Public key of the minter account."""
    dest: Pubkey
    """Public key of the account to mint to."""
    mint_authority: Pubkey
    """The mint authority."""
    amount: int
    """Amount to mint."""
    signers: List[Pubkey] = []
    """Signing accounts if `mint_authority` is a multiSig."""


class BurnParams(NamedTuple):
    """Burn token transaction params."""

    program_id: Pubkey
    """SPL Token program account."""
    account: Pubkey
    """Account to burn tokens from."""
    mint: Pubkey
    """Public key of the minter account."""
    owner: Pubkey
    """Owner of the account."""
    amount: int
    """Amount to burn."""
    signers: List[Pubkey] = []
    """Signing accounts if `owner` is a multiSig"""


class CloseAccountParams(NamedTuple):
    """Close token account transaction params."""

    program_id: Pubkey
    """SPL Token program account."""
    account: Pubkey
    """Address of account to close."""
    dest: Pubkey
    """Address of account to receive the remaining balance of the closed account."""
    owner: Pubkey
    """Owner of the account."""
    signers: List[Pubkey] = []
    """Signing accounts if `owner` is a multiSig"""


class FreezeAccountParams(NamedTuple):
    """Freeze token account transaction params."""

    program_id: Pubkey
    """SPL Token program account."""
    account: Pubkey
    """Account to freeze."""
    mint: Pubkey
    """Public key of the minter account."""
    authority: Pubkey
    """Mint freeze authority"""
    multi_signers: List[Pubkey] = []
    """Signing accounts if `authority` is a multiSig"""


class ThawAccountParams(NamedTuple):
    """Thaw token account transaction params."""

    program_id: Pubkey
    """SPL Token program account."""
    account: Pubkey
    """Account to thaw."""
    mint: Pubkey
    """Public key of the minter account."""
    authority: Pubkey
    """Mint freeze authority"""
    multi_signers: List[Pubkey] = []
    """Signing accounts if `authority` is a multiSig"""


class TransferCheckedParams(NamedTuple):
    """TransferChecked token transaction params."""

    program_id: Pubkey
    """SPL Token program account."""
    source: Pubkey
    """Source account."""
    mint: Pubkey
    """Public key of the minter account."""
    dest: Pubkey
    """Destination account."""
    owner: Pubkey
    """Owner of the source account."""
    amount: int
    """Number of tokens to transfer."""
    decimals: int
    """Amount decimals."""
    signers: List[Pubkey] = []
    """Signing accounts if `owner` is a multiSig."""


class ApproveCheckedParams(NamedTuple):
    """ApproveChecked token transaction params."""

    program_id: Pubkey
    """SPL Token program account."""
    source: Pubkey
    """Source account."""
    mint: Pubkey
    """Public key of the minter account."""
    delegate: Pubkey
    """Delegate account authorized to perform a transfer of tokens from the source account."""
    owner: Pubkey
    """Owner of the source account."""
    amount: int
    """Maximum number of tokens the delegate may transfer."""
    decimals: int
    """Amount decimals."""
    signers: List[Pubkey] = []
    """Signing accounts if `owner` is a multiSig."""


class MintToCheckedParams(NamedTuple):
    """MintToChecked token transaction params."""

    program_id: Pubkey
    """SPL Token program account."""
    mint: Pubkey
    """Public key of the minter account."""
    dest: Pubkey
    """Public key of the account to mint to."""
    mint_authority: Pubkey
    """The mint authority."""
    amount: int
    """Amount to mint."""
    decimals: int
    """Amount decimals."""
    signers: List[Pubkey] = []
    """Signing accounts if `mint_authority` is a multiSig."""


class BurnCheckedParams(NamedTuple):
    """BurnChecked token transaction params."""

    program_id: Pubkey
    """SPL Token program account."""
    mint: Pubkey
    """Public key of the minter account."""
    account: Pubkey
    """Account to burn tokens from."""
    owner: Pubkey
    """Owner of the account."""
    amount: int
    """Amount to burn."""
    decimals: int
    """Amount decimals."""
    signers: List[Pubkey] = []
    """Signing accounts if `owner` is a multiSig"""


class SyncNativeParams(NamedTuple):
    """BurnChecked token transaction params."""

    program_id: Pubkey
    """SPL Token program account."""
    account: Pubkey
    """Account to sync."""


def __parse_and_validate_instruction(
    instruction: Instruction,
    expected_keys: int,
    expected_type: InstructionType,
) -> Any:  # Returns a Construct container.
    validate_instruction_keys(instruction, expected_keys)
    data = INSTRUCTIONS_LAYOUT.parse(instruction.data)
    validate_instruction_type(data, expected_type)
    return data


def decode_initialize_mint(instruction: Instruction) -> InitializeMintParams:
    """Decode an initialize mint token instruction and retrieve the instruction params.

    Args:
        instruction: The instruction to decode.

    Returns:
        The decoded instruction.
    """
    parsed_data = __parse_and_validate_instruction(instruction, 2, InstructionType.INITIALIZE_MINT)
    return InitializeMintParams(
        decimals=parsed_data.args.decimals,
        program_id=instruction.program_id,
        mint=instruction.accounts[0].pubkey,
        mint_authority=Pubkey(parsed_data.args.mint_authority),
        freeze_authority=Pubkey(parsed_data.args.freeze_authority)
        if parsed_data.args.freeze_authority_option
        else None,
    )


def decode_initialize_account(instruction: Instruction) -> InitializeAccountParams:
    """Decode an initialize account token instruction and retrieve the instruction params.

    Args:
        instruction: The instruction to decode.

    Returns:
        The decoded instruction.
    """
    _ = __parse_and_validate_instruction(instruction, 4, InstructionType.INITIALIZE_ACCOUNT)
    return InitializeAccountParams(
        program_id=instruction.program_id,
        account=instruction.accounts[0].pubkey,
        mint=instruction.accounts[1].pubkey,
        owner=instruction.accounts[2].pubkey,
    )


def decode_initialize_multisig(instruction: Instruction) -> InitializeMultisigParams:
    """Decode an initialize multisig account token instruction and retrieve the instruction params.

    Args:
        instruction: The instruction to decode.

    Returns:
        The decoded instruction.
    """
    parsed_data = __parse_and_validate_instruction(instruction, 2, InstructionType.INITIALIZE_MULTISIG)
    num_signers = parsed_data.args.m
    validate_instruction_keys(instruction, 2 + num_signers)
    return InitializeMultisigParams(
        program_id=instruction.program_id,
        multisig=instruction.accounts[0].pubkey,
        signers=[signer.pubkey for signer in instruction.accounts[-num_signers:]],
        m=num_signers,
    )


def decode_transfer(instruction: Instruction) -> TransferParams:
    """Decode a transfer token transaction and retrieve the instruction params.

    Args:
        instruction: The instruction to decode.

    Returns:
        The decoded instruction.
    """
    parsed_data = __parse_and_validate_instruction(instruction, 3, InstructionType.TRANSFER)
    return TransferParams(
        program_id=instruction.program_id,
        source=instruction.accounts[0].pubkey,
        dest=instruction.accounts[1].pubkey,
        owner=instruction.accounts[2].pubkey,
        signers=[signer.pubkey for signer in instruction.accounts[3:]],
        amount=parsed_data.args.amount,
    )


def decode_approve(instruction: Instruction) -> ApproveParams:
    """Decode a approve token transaction and retrieve the instruction params.

    Args:
        instruction: The instruction to decode.

    Returns:
        The decoded instruction.
    """
    parsed_data = __parse_and_validate_instruction(instruction, 3, InstructionType.APPROVE)
    return ApproveParams(
        program_id=instruction.program_id,
        source=instruction.accounts[0].pubkey,
        delegate=instruction.accounts[1].pubkey,
        owner=instruction.accounts[2].pubkey,
        signers=[signer.pubkey for signer in instruction.accounts[3:]],
        amount=parsed_data.args.amount,
    )


def decode_revoke(instruction: Instruction) -> RevokeParams:
    """Decode a revoke token transaction and retrieve the instruction params.

    Args:
        instruction: The instruction to decode.

    Returns:
        The decoded instruction.
    """
    _ = __parse_and_validate_instruction(instruction, 2, InstructionType.REVOKE)
    return RevokeParams(
        program_id=instruction.program_id,
        account=instruction.accounts[0].pubkey,
        owner=instruction.accounts[1].pubkey,
        signers=[signer.pubkey for signer in instruction.accounts[2:]],
    )


def decode_set_authority(instruction: Instruction) -> SetAuthorityParams:
    """Decode a set authority token transaction and retrieve the instruction params.

    Args:
        instruction: The instruction to decode.

    Returns:
        The decoded instruction.
    """
    parsed_data = __parse_and_validate_instruction(instruction, 2, InstructionType.SET_AUTHORITY)
    return SetAuthorityParams(
        program_id=instruction.program_id,
        account=instruction.accounts[0].pubkey,
        authority=AuthorityType(parsed_data.args.authority_type),
        new_authority=Pubkey(parsed_data.args.new_authority) if parsed_data.args.new_authority_option else None,
        current_authority=instruction.accounts[1].pubkey,
        signers=[signer.pubkey for signer in instruction.accounts[2:]],
    )


def decode_mint_to(instruction: Instruction) -> MintToParams:
    """Decode a mint to token transaction and retrieve the instruction params.

    Args:
        instruction: The instruction to decode.

    Returns:
        The decoded instruction.
    """
    parsed_data = __parse_and_validate_instruction(instruction, 3, InstructionType.MINT_TO)
    return MintToParams(
        program_id=instruction.program_id,
        amount=parsed_data.args.amount,
        mint=instruction.accounts[0].pubkey,
        dest=instruction.accounts[1].pubkey,
        mint_authority=instruction.accounts[2].pubkey,
        signers=[signer.pubkey for signer in instruction.accounts[3:]],
    )


def decode_burn(instruction: Instruction) -> BurnParams:
    """Decode a burn token transaction and retrieve the instruction params.

    Args:
        instruction: The instruction to decode.

    Returns:
        The decoded instruction.
    """
    parsed_data = __parse_and_validate_instruction(instruction, 3, InstructionType.BURN)
    return BurnParams(
        program_id=instruction.program_id,
        amount=parsed_data.args.amount,
        account=instruction.accounts[0].pubkey,
        mint=instruction.accounts[1].pubkey,
        owner=instruction.accounts[2].pubkey,
        signers=[signer.pubkey for signer in instruction.accounts[3:]],
    )


def decode_close_account(instruction: Instruction) -> CloseAccountParams:
    """Decode a close account token transaction and retrieve the instruction params.

    Args:
        instruction: The instruction to decode.

    Returns:
        The decoded instruction.
    """
    _ = __parse_and_validate_instruction(instruction, 3, InstructionType.CLOSE_ACCOUNT)
    return CloseAccountParams(
        program_id=instruction.program_id,
        account=instruction.accounts[0].pubkey,
        dest=instruction.accounts[1].pubkey,
        owner=instruction.accounts[2].pubkey,
        signers=[signer.pubkey for signer in instruction.accounts[3:]],
    )


def decode_freeze_account(instruction: Instruction) -> FreezeAccountParams:
    """Decode a freeze account token transaction and retrieve the instruction params.

    Args:
        instruction: The instruction to decode.

    Returns:
        The decoded instruction.
    """
    _ = __parse_and_validate_instruction(instruction, 3, InstructionType.FREEZE_ACCOUNT)
    return FreezeAccountParams(
        program_id=instruction.program_id,
        account=instruction.accounts[0].pubkey,
        mint=instruction.accounts[1].pubkey,
        authority=instruction.accounts[2].pubkey,
        multi_signers=[signer.pubkey for signer in instruction.accounts[3:]],
    )


def decode_thaw_account(instruction: Instruction) -> ThawAccountParams:
    """Decode a thaw account token transaction and retrieve the instruction params.

    Args:
        instruction: The instruction to decode.

    Returns:
        The decoded instruction.
    """
    _ = __parse_and_validate_instruction(instruction, 3, InstructionType.THAW_ACCOUNT)
    return ThawAccountParams(
        program_id=instruction.program_id,
        account=instruction.accounts[0].pubkey,
        mint=instruction.accounts[1].pubkey,
        authority=instruction.accounts[2].pubkey,
        multi_signers=[signer.pubkey for signer in instruction.accounts[3:]],
    )


def decode_transfer_checked(instruction: Instruction) -> TransferCheckedParams:
    """Decode a transfer_checked token transaction and retrieve the instruction params.

    Args:
        instruction: The instruction to decode.

    Returns:
        The decoded instruction.
    """
    parsed_data = __parse_and_validate_instruction(instruction, 4, InstructionType.TRANSFER2)
    return TransferCheckedParams(
        program_id=instruction.program_id,
        amount=parsed_data.args.amount,
        decimals=parsed_data.args.decimals,
        source=instruction.accounts[0].pubkey,
        mint=instruction.accounts[1].pubkey,
        dest=instruction.accounts[2].pubkey,
        owner=instruction.accounts[3].pubkey,
        signers=[signer.pubkey for signer in instruction.accounts[4:]],
    )


def decode_approve_checked(instruction: Instruction) -> ApproveCheckedParams:
    """Decode a approve_checked token transaction and retrieve the instruction params.

    Args:
        instruction: The instruction to decode.

    Returns:
        The decoded instruction.
    """
    parsed_data = __parse_and_validate_instruction(instruction, 4, InstructionType.APPROVE2)
    return ApproveCheckedParams(
        program_id=instruction.program_id,
        amount=parsed_data.args.amount,
        decimals=parsed_data.args.decimals,
        source=instruction.accounts[0].pubkey,
        mint=instruction.accounts[1].pubkey,
        delegate=instruction.accounts[2].pubkey,
        owner=instruction.accounts[3].pubkey,
        signers=[signer.pubkey for signer in instruction.accounts[4:]],
    )


def decode_mint_to_checked(instruction: Instruction) -> MintToCheckedParams:
    """Decode a mintTo2 token transaction and retrieve the instruction params.

    Args:
        instruction: The instruction to decode.

    Returns:
        The decoded instruction.
    """
    parsed_data = __parse_and_validate_instruction(instruction, 3, InstructionType.MINT_TO2)
    return MintToCheckedParams(
        program_id=instruction.program_id,
        amount=parsed_data.args.amount,
        decimals=parsed_data.args.decimals,
        mint=instruction.accounts[0].pubkey,
        dest=instruction.accounts[1].pubkey,
        mint_authority=instruction.accounts[2].pubkey,
        signers=[signer.pubkey for signer in instruction.accounts[3:]],
    )


def decode_burn_checked(instruction: Instruction) -> BurnCheckedParams:
    """Decode a burn_checked token transaction and retrieve the instruction params.

    Args:
        instruction: The instruction to decode.

    Returns:
        The decoded instruction.
    """
    parsed_data = __parse_and_validate_instruction(instruction, 3, InstructionType.BURN2)
    return BurnCheckedParams(
        program_id=instruction.program_id,
        amount=parsed_data.args.amount,
        decimals=parsed_data.args.decimals,
        account=instruction.accounts[0].pubkey,
        mint=instruction.accounts[1].pubkey,
        owner=instruction.accounts[2].pubkey,
        signers=[signer.pubkey for signer in instruction.accounts[3:]],
    )


def decode_sync_native(instruction: Instruction) -> SyncNativeParams:
    """Decode a burn_checked token transaction and retrieve the instruction params.

    Args:
        instruction: The instruction to decode.

    Returns:
        The decoded instruction.
    """
    return SyncNativeParams(
        program_id=instruction.program_id,
        account=instruction.accounts[0].pubkey,
    )


def __add_signers(keys: List[AccountMeta], owner: Pubkey, signers: List[Pubkey]) -> None:
    if signers:
        keys.append(AccountMeta(pubkey=owner, is_signer=False, is_writable=False))
        for signer in signers:
            keys.append(AccountMeta(pubkey=signer, is_signer=True, is_writable=False))
    else:
        keys.append(AccountMeta(pubkey=owner, is_signer=True, is_writable=False))


def __burn_instruction(params: Union[BurnParams, BurnCheckedParams], data: Any) -> Instruction:
    keys = [
        AccountMeta(pubkey=params.account, is_signer=False, is_writable=True),
        AccountMeta(pubkey=params.mint, is_signer=False, is_writable=True),
    ]
    __add_signers(keys, params.owner, params.signers)

    return Instruction(accounts=keys, program_id=params.program_id, data=data)


def __sync_native_instruction(params: SyncNativeParams, data: Any) -> Instruction:
    keys = [
        AccountMeta(pubkey=params.account, is_signer=False, is_writable=True),
    ]

    return Instruction(accounts=keys, program_id=params.program_id, data=data)


def __freeze_or_thaw_instruction(
    params: Union[FreezeAccountParams, ThawAccountParams],
    instruction_type: InstructionType,
) -> Instruction:
    data = INSTRUCTIONS_LAYOUT.build({"instruction_type": instruction_type, "args": None})
    keys = [
        AccountMeta(pubkey=params.account, is_signer=False, is_writable=True),
        AccountMeta(pubkey=params.mint, is_signer=False, is_writable=False),
    ]
    __add_signers(keys, params.authority, params.multi_signers)

    return Instruction(accounts=keys, program_id=params.program_id, data=data)


def __mint_to_instruction(params: Union[MintToParams, MintToCheckedParams], data: Any) -> Instruction:
    keys = [
        AccountMeta(pubkey=params.mint, is_signer=False, is_writable=True),
        AccountMeta(pubkey=params.dest, is_signer=False, is_writable=True),
    ]
    __add_signers(keys, params.mint_authority, params.signers)

    return Instruction(accounts=keys, program_id=params.program_id, data=data)


def initialize_mint(params: InitializeMintParams) -> Instruction:
    """Creates a transaction instruction to initialize a new mint newly.

    This instruction requires no signers and MUST be included within the same Transaction as
    the system program's `CreateInstruction` that creates the account being initialized.
    Otherwise another party can acquire ownership of the uninitialized account.

    Example:
        >>> from spl.token.constants import TOKEN_PROGRAM_ID
        >>> from solders.pubkey import Pubkey
        >>> leading_zeros = [0] * 31
        >>> pubkeys = [Pubkey(leading_zeros + [i +1]) for i in range(4)]
        >>> mint_account, mint_authority, freeze_authority, owner = pubkeys
        >>> params = InitializeMintParams(
        ...     decimals=6,
        ...     freeze_authority=freeze_authority,
        ...     mint=mint_account,
        ...     mint_authority=mint_authority,
        ...     program_id=TOKEN_PROGRAM_ID,
        ... )
        >>> type(initialize_mint(params))
        <class 'solders.instruction.Instruction'>

    Returns:
        The instruction to initialize the mint.
    """
    freeze_authority, opt = (params.freeze_authority, 1) if params.freeze_authority else (Pubkey([0] * 31 + [0]), 0)
    data = INSTRUCTIONS_LAYOUT.build(
        {
            "instruction_type": InstructionType.INITIALIZE_MINT,
            "args": {
                "decimals": params.decimals,
                "mint_authority": bytes(params.mint_authority),
                "freeze_authority_option": opt,
                "freeze_authority": bytes(freeze_authority),
            },
        }
    )
    return Instruction(
        accounts=[
            AccountMeta(pubkey=params.mint, is_signer=False, is_writable=True),
            AccountMeta(pubkey=RENT, is_signer=False, is_writable=False),
        ],
        program_id=params.program_id,
        data=data,
    )


def initialize_account(params: InitializeAccountParams) -> Instruction:
    """Creates a transaction instruction to initialize a new account to hold tokens.

    This instruction requires no signers and MUST be included within the same Transaction as
    the system program's `CreateInstruction` that creates the account being initialized.
    Otherwise another party can acquire ownership of the uninitialized account.

    Example:
        >>> leading_zeros = [0] * 31
        >>> pubkeys = [Pubkey(leading_zeros + [i + 1]) for i in range(4)]
        >>> account, mint, owner, token = pubkeys
        >>> params = InitializeAccountParams(
        ...     account=account,
        ...     mint=mint,
        ...     owner=owner,
        ...     program_id=token,
        ... )
        >>> type(initialize_account(params))
        <class 'solders.instruction.Instruction'>

    Returns:
        The instruction to initialize the account.
    """
    data = INSTRUCTIONS_LAYOUT.build({"instruction_type": InstructionType.INITIALIZE_ACCOUNT, "args": None})
    return Instruction(
        accounts=[
            AccountMeta(pubkey=params.account, is_signer=False, is_writable=True),
            AccountMeta(pubkey=params.mint, is_signer=False, is_writable=False),
            AccountMeta(pubkey=params.owner, is_signer=False, is_writable=False),
            AccountMeta(pubkey=RENT, is_signer=False, is_writable=False),
        ],
        program_id=params.program_id,
        data=data,
    )


def initialize_multisig(params: InitializeMultisigParams) -> Instruction:
    """Creates a transaction instruction to initialize a multisignature account with N provided signers.

    This instruction requires no signers and MUST be included within the same Transaction as
    the system program's `CreateInstruction` that creates the account being initialized.
    Otherwise another party can acquire ownership of the uninitialized account.

    Example:
        >>> m = 2   # Two signers
        >>> signers = [Pubkey([0] * 31 + [i]) for i in range(m)]
        >>> leading_zeros = [0] * 31
        >>> multisig_account, token = Pubkey(leading_zeros + [1]), Pubkey(leading_zeros + [2])
        >>> params = InitializeMultisigParams(
        ...     m=m,
        ...     multisig=multisig_account,
        ...     signers=signers,
        ...     program_id=token,
        ... )
        >>> type(initialize_multisig(params))
        <class 'solders.instruction.Instruction'>

    Returns:
        The instruction to initialize the multisig.
    """
    data = INSTRUCTIONS_LAYOUT.build(
        {
            "instruction_type": InstructionType.INITIALIZE_MULTISIG,
            "args": {"m": params.m},
        }
    )
    keys = [
        AccountMeta(pubkey=params.multisig, is_signer=False, is_writable=True),
        AccountMeta(pubkey=RENT, is_signer=False, is_writable=False),
    ]
    for signer in params.signers:
        keys.append(AccountMeta(pubkey=signer, is_signer=False, is_writable=False))

    return Instruction(accounts=keys, program_id=params.program_id, data=data)


def transfer(params: TransferParams) -> Instruction:
    """Creates a transaction instruction to transfers tokens from one account to another.

    Either directly or via a delegate.

    Example:
        >>> leading_zeros = [0] * 31
        >>> pubkeys = [Pubkey(leading_zeros + [i + 1]) for i in range(4)]
        >>> dest, owner, source, token = pubkeys
        >>> params = TransferParams(
        ...     amount=1000,
        ...     dest=dest,
        ...     owner=owner,
        ...     program_id=token,
        ...     source=source,
        ... )
        >>> type(transfer(params))
        <class 'solders.instruction.Instruction'>

    Returns:
        The transfer instruction.
    """
    data = INSTRUCTIONS_LAYOUT.build(
        {
            "instruction_type": InstructionType.TRANSFER,
            "args": {"amount": params.amount},
        }
    )
    keys = [
        AccountMeta(pubkey=params.source, is_signer=False, is_writable=True),
        AccountMeta(pubkey=params.dest, is_signer=False, is_writable=True),
    ]
    __add_signers(keys, params.owner, params.signers)

    return Instruction(accounts=keys, program_id=params.program_id, data=data)


def approve(params: ApproveParams) -> Instruction:
    """Creates a transaction instruction to approve a delegate.

    Example:
        >>> leading_zeros = [0] * 31
        >>> pubkeys = [Pubkey(leading_zeros + [i + 1]) for i in range(4)]
        >>> delegate, owner, source, token = pubkeys
        >>> params = ApproveParams(
        ...     amount=123,
        ...     delegate=delegate,
        ...     owner=owner,
        ...     program_id=token,
        ...     source=source
        ... )
        >>> type(approve(params))
        <class 'solders.instruction.Instruction'>

    Returns:
        The approve instruction.
    """
    data = INSTRUCTIONS_LAYOUT.build({"instruction_type": InstructionType.APPROVE, "args": {"amount": params.amount}})
    keys = [
        AccountMeta(pubkey=params.source, is_signer=False, is_writable=True),
        AccountMeta(pubkey=params.delegate, is_signer=False, is_writable=False),
    ]
    __add_signers(keys, params.owner, params.signers)

    return Instruction(accounts=keys, program_id=params.program_id, data=data)


def revoke(params: RevokeParams) -> Instruction:
    """Creates a transaction instruction that revokes delegate authority for a given account.

    Example:
        >>> leading_zeros = [0] * 31
        >>> pubkeys = [Pubkey(leading_zeros + [i + 1]) for i in range(3)]
        >>> account, owner, token = pubkeys
        >>> params = RevokeParams(
        ...     account=account, owner=owner, program_id=token
        ... )
        >>> type(revoke(params))
        <class 'solders.instruction.Instruction'>

    Returns:
        The revoke instruction.
    """
    data = INSTRUCTIONS_LAYOUT.build({"instruction_type": InstructionType.REVOKE, "args": None})
    keys = [AccountMeta(pubkey=params.account, is_signer=False, is_writable=True)]
    __add_signers(keys, params.owner, params.signers)

    return Instruction(accounts=keys, program_id=params.program_id, data=data)


def set_authority(params: SetAuthorityParams) -> Instruction:
    """Creates a transaction instruction to sets a new authority of a mint or account.

    Example:
        >>> leading_zeros = [0] * 31
        >>> pubkeys = [Pubkey(leading_zeros + [i + 1]) for i in range(4)]
        >>> account, current_authority, new_authority, token = pubkeys
        >>> params = SetAuthorityParams(
        ...     account=account,
        ...     authority=AuthorityType.ACCOUNT_OWNER,
        ...     current_authority=current_authority,
        ...     new_authority=new_authority,
        ...     program_id=token,
        ... )
        >>> type(set_authority(params))
        <class 'solders.instruction.Instruction'>

    Returns:
        The set authority instruction.
    """
    new_authority, opt = (params.new_authority, 1) if params.new_authority else (Pubkey([0] * 31 + [0]), 0)
    data = INSTRUCTIONS_LAYOUT.build(
        {
            "instruction_type": InstructionType.SET_AUTHORITY,
            "args": {
                "authority_type": params.authority,
                "new_authority_option": opt,
                "new_authority": bytes(new_authority),
            },
        }
    )
    keys = [AccountMeta(pubkey=params.account, is_signer=False, is_writable=True)]
    __add_signers(keys, params.current_authority, params.signers)

    return Instruction(accounts=keys, program_id=params.program_id, data=data)


def mint_to(params: MintToParams) -> Instruction:
    """Creates a transaction instruction to mint new tokens to an account.

    The native mint does not support minting.

    Example:
        >>> leading_zeros = [0] * 31
        >>> pubkeys = [Pubkey(leading_zeros + [i + 1]) for i in range(4)]
        >>> dest, mint, mint_authority, token = pubkeys
        >>> params = MintToParams(
        ...     amount=123,
        ...     dest=dest,
        ...     mint=mint,
        ...     mint_authority=mint_authority,
        ...     program_id=token,
        ... )
        >>> type(mint_to(params))
        <class 'solders.instruction.Instruction'>

    Returns:
        The mint-to instruction.
    """
    data = INSTRUCTIONS_LAYOUT.build({"instruction_type": InstructionType.MINT_TO, "args": {"amount": params.amount}})
    return __mint_to_instruction(params, data)


def burn(params: BurnParams) -> Instruction:
    """Creates a transaction instruction to burns tokens by removing them from an account.

    Example:
        >>> leading_zeros = [0] * 31
        >>> pubkeys = [Pubkey(leading_zeros + [i + 1]) for i in range(4)]
        >>> account, mint, owner, token = pubkeys
        >>> params = BurnParams(
        ...     amount=123, account=account, mint=mint, owner=owner, program_id=token,
        ... )
        >>> type(burn(params))
        <class 'solders.instruction.Instruction'>

    Returns:
        The burn instruction.
    """
    data = INSTRUCTIONS_LAYOUT.build({"instruction_type": InstructionType.BURN, "args": {"amount": params.amount}})
    return __burn_instruction(params, data)


def close_account(params: CloseAccountParams) -> Instruction:
    """Creates a transaction instruction to close an account by transferring all its SOL to the destination account.

    Non-native accounts may only be closed if its token amount is zero.

    Example:
        >>> leading_zeros = [0] * 31
        >>> pubkeys = [Pubkey(leading_zeros + [i + 1]) for i in range(4)]
        >>> account, dest, owner, token = pubkeys
        >>> params = CloseAccountParams(
        ...     account=account, dest=dest, owner=owner, program_id=token)
        >>> type(close_account(params))
        <class 'solders.instruction.Instruction'>

    Returns:
        The close-account instruction.
    """
    data = INSTRUCTIONS_LAYOUT.build({"instruction_type": InstructionType.CLOSE_ACCOUNT, "args": None})
    keys = [
        AccountMeta(pubkey=params.account, is_signer=False, is_writable=True),
        AccountMeta(pubkey=params.dest, is_signer=False, is_writable=True),
    ]
    __add_signers(keys, params.owner, params.signers)

    return Instruction(accounts=keys, program_id=params.program_id, data=data)


def freeze_account(params: FreezeAccountParams) -> Instruction:
    """Creates a transaction instruction to freeze an initialized account using the mint's freeze_authority (if set).

    Example:
        >>> leading_zeros = [0] * 31
        >>> pubkeys = [Pubkey(leading_zeros + [i + 1]) for i in range(4)]
        >>> account, mint, authority, token = pubkeys
        >>> params = FreezeAccountParams(
        ...     account=account, mint=mint, authority=authority, program_id=token)
        >>> type(freeze_account(params))
        <class 'solders.instruction.Instruction'>

    Returns:
        The freeze-account instruction.
    """
    return __freeze_or_thaw_instruction(params, InstructionType.FREEZE_ACCOUNT)


def thaw_account(params: ThawAccountParams) -> Instruction:
    """Creates a transaction instruction to thaw a frozen account using the Mint's freeze_authority (if set).

    Example:
        >>> leading_zeros = [0] * 31
        >>> pubkeys = [Pubkey(leading_zeros + [i + 1]) for i in range(4)]
        >>> account, mint, authority, token = pubkeys
        >>> params = ThawAccountParams(
        ...     account=account, mint=mint, authority=authority, program_id=token)
        >>> type(thaw_account(params))
        <class 'solders.instruction.Instruction'>

    Returns:
        The thaw-account instruction.
    """
    return __freeze_or_thaw_instruction(params, InstructionType.THAW_ACCOUNT)


def transfer_checked(params: TransferCheckedParams) -> Instruction:
    """This instruction differs from `transfer` in that the token mint and decimals value is asserted by the caller.

    Example:
        >>> leading_zeros = [0] * 31
        >>> pubkeys = [Pubkey(leading_zeros + [i + 1]) for i in range(5)]
        >>> dest, mint, owner, source, token = pubkeys
        >>> params = TransferCheckedParams(
        ...     amount=1000,
        ...     decimals=6,
        ...     dest=dest,
        ...     mint=mint,
        ...     owner=owner,
        ...     program_id=token,
        ...     source=source,
        ... )
        >>> type(transfer_checked(params))
        <class 'solders.instruction.Instruction'>

    Returns:
        The transfer-checked instruction.
    """
    data = INSTRUCTIONS_LAYOUT.build(
        {
            "instruction_type": InstructionType.TRANSFER2,
            "args": {"amount": params.amount, "decimals": params.decimals},
        }
    )
    keys = [
        AccountMeta(pubkey=params.source, is_signer=False, is_writable=True),
        AccountMeta(pubkey=params.mint, is_signer=False, is_writable=False),
        AccountMeta(pubkey=params.dest, is_signer=False, is_writable=True),
    ]
    __add_signers(keys, params.owner, params.signers)

    return Instruction(accounts=keys, program_id=params.program_id, data=data)


def approve_checked(params: ApproveCheckedParams) -> Instruction:
    """This instruction differs from `approve` in that the token mint and decimals value is asserted by the caller.

    Example:
        >>> leading_zeros = [0] * 31
        >>> pubkeys = [Pubkey(leading_zeros + [i + 1]) for i in range(5)]
        >>> delegate, mint, owner, source, token = pubkeys
        >>> params = ApproveCheckedParams(
        ...     amount=1000,
        ...     decimals=6,
        ...     delegate=delegate,
        ...     mint=mint,
        ...     owner=owner,
        ...     program_id=token,
        ...     source=source,
        ... )
        >>> type(approve_checked(params))
        <class 'solders.instruction.Instruction'>

    Returns:
        The approve-checked instruction.
    """
    data = INSTRUCTIONS_LAYOUT.build(
        {
            "instruction_type": InstructionType.APPROVE2,
            "args": {"amount": params.amount, "decimals": params.decimals},
        }
    )
    keys = [
        AccountMeta(pubkey=params.source, is_signer=False, is_writable=True),
        AccountMeta(pubkey=params.mint, is_signer=False, is_writable=False),
        AccountMeta(pubkey=params.delegate, is_signer=False, is_writable=False),
    ]
    __add_signers(keys, params.owner, params.signers)

    return Instruction(accounts=keys, program_id=params.program_id, data=data)


def mint_to_checked(params: MintToCheckedParams) -> Instruction:
    """This instruction differs from `mint_to` in that the decimals value is asserted by the caller.

    Example:
        >>> leading_zeros = [0] * 31
        >>> pubkeys = [Pubkey(leading_zeros + [i + 1]) for i in range(4)]
        >>> dest, mint, mint_authority, token = pubkeys
        >>> params = MintToCheckedParams(
        ...     amount=123,
        ...     decimals=6,
        ...     dest=dest,
        ...     mint=mint,
        ...     mint_authority=mint_authority,
        ...     program_id=token,
        ... )
        >>> type(mint_to_checked(params))
        <class 'solders.instruction.Instruction'>

    Returns:
        The mint-to-checked instruction.
    """
    data = INSTRUCTIONS_LAYOUT.build(
        {
            "instruction_type": InstructionType.MINT_TO2,
            "args": {"amount": params.amount, "decimals": params.decimals},
        }
    )
    return __mint_to_instruction(params, data)


def burn_checked(params: BurnCheckedParams) -> Instruction:
    """This instruction differs from `burn` in that the decimals value is asserted by the caller.

    Example:
        >>> leading_zeros = [0] * 31
        >>> pubkeys = [Pubkey(leading_zeros + [i + 1]) for i in range(4)]
        >>> account, mint, owner, token = pubkeys
        >>> params = BurnCheckedParams(
        ...     amount=123, account=account, decimals=6, mint=mint, owner=owner, program_id=token,
        ... )
        >>> type(burn_checked(params))
        <class 'solders.instruction.Instruction'>

    Returns:
        The burn-checked instruction.
    """
    data = INSTRUCTIONS_LAYOUT.build(
        {
            "instruction_type": InstructionType.BURN2,
            "args": {"amount": params.amount, "decimals": params.decimals},
        }
    )
    return __burn_instruction(params, data)


def sync_native(params: SyncNativeParams) -> Instruction:
    """Syncs the amount field with the number of lamports of the account.

    Example:
        >>> account = Pubkey.default()
        >>> params = SyncNativeParams(
        ...     program_id=TOKEN_PROGRAM_ID, account=account,
        ... )
        >>> type(sync_native(params))
        <class 'solders.instruction.Instruction'>

    Returns:
        The sync-native instruction.
    """
    data = INSTRUCTIONS_LAYOUT.build(
        {
            "instruction_type": InstructionType.SYNC_NATIVE,
            "args": {},
        }
    )
    return __sync_native_instruction(params, data)


def get_associated_token_address(owner: Pubkey, mint: Pubkey, token_program_id: Pubkey = TOKEN_PROGRAM_ID) -> Pubkey:
    """Derives the associated token address for the given wallet address and token mint.

    Args:
        owner (Pubkey): Owner's wallet address.
        mint (Pubkey): The token mint address.
        token_program_id (Pubkey, optional): The token program ID. Must be either `spl.token.constants.TOKEN_PROGRAM_ID`
            or `spl.token.constants.TOKEN_2022_PROGRAM_ID` (default is `TOKEN_PROGRAM_ID`).

    Returns:
        The public key of the derived associated token address.

    Raises:
        ValueError: If an invalid `token_program_id` is provided.
    """
    if token_program_id not in [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]:
        raise ValueError("token_program_id must be one of TOKEN_PROGRAM_ID or TOKEN_2022_PROGRAM_ID.")
    key, _ = Pubkey.find_program_address(
        seeds=[bytes(owner), bytes(token_program_id), bytes(mint)],
        program_id=ASSOCIATED_TOKEN_PROGRAM_ID,
    )
    return key


def create_associated_token_account(
    payer: Pubkey, owner: Pubkey, mint: Pubkey, token_program_id: Pubkey = TOKEN_PROGRAM_ID
) -> Instruction:
    """Creates a transaction instruction to create an associated token account.

    Args:
        payer (Pubkey): Payer's wallet address.
        owner (Pubkey): Owner's wallet address.
        mint (Pubkey): The token mint address.
        token_program_id (Pubkey, optional): The token program ID. Must be either `spl.token.constants.TOKEN_PROGRAM_ID`
            or `spl.token.constants.TOKEN_2022_PROGRAM_ID` (default is `TOKEN_PROGRAM_ID`).

    Returns:
        The instruction to create the associated token account.

    Raises:
        ValueError: If an invalid `token_program_id` is provided.
    """
    if token_program_id not in [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]:
        raise ValueError("token_program_id must be one of TOKEN_PROGRAM_ID or TOKEN_2022_PROGRAM_ID.")
    associated_token_address = get_associated_token_address(owner, mint, token_program_id)
    return Instruction(
        accounts=[
            AccountMeta(pubkey=payer, is_signer=True, is_writable=True),
            AccountMeta(pubkey=associated_token_address, is_signer=False, is_writable=True),
            AccountMeta(pubkey=owner, is_signer=False, is_writable=False),
            AccountMeta(pubkey=mint, is_signer=False, is_writable=False),
            AccountMeta(pubkey=SYS_PROGRAM_ID, is_signer=False, is_writable=False),
            AccountMeta(pubkey=token_program_id, is_signer=False, is_writable=False),
            AccountMeta(pubkey=RENT, is_signer=False, is_writable=False),
        ],
        program_id=ASSOCIATED_TOKEN_PROGRAM_ID,
        data=bytes(0),
    )


def create_idempotent_associated_token_account(
    payer: Pubkey, owner: Pubkey, mint: Pubkey, token_program_id: Pubkey = TOKEN_PROGRAM_ID
) -> Instruction:
    """Creates an associated token account for the given address/token mint if it not exists.

    Returns:
        The instruction to create the associated token account.
    """
    if token_program_id not in [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]:
        raise ValueError("token_program_id must be one of TOKEN_PROGRAM_ID or TOKEN_2022_PROGRAM_ID.")
    associated_token_address = get_associated_token_address(owner, mint, token_program_id)
    return Instruction(
        accounts=[
            AccountMeta(pubkey=payer, is_signer=True, is_writable=True),
            AccountMeta(pubkey=associated_token_address, is_signer=False, is_writable=True),
            AccountMeta(pubkey=owner, is_signer=False, is_writable=False),
            AccountMeta(pubkey=mint, is_signer=False, is_writable=False),
            AccountMeta(pubkey=SYS_PROGRAM_ID, is_signer=False, is_writable=False),
            AccountMeta(pubkey=token_program_id, is_signer=False, is_writable=False),
        ],
        program_id=ASSOCIATED_TOKEN_PROGRAM_ID,
        data=bytes([1]),
    )
