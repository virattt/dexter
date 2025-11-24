# pylint: disable=too-many-arguments
"""Async SPL Token program client."""

from __future__ import annotations

from typing import List, Optional, Union, cast

from solders.hash import Hash as Blockhash
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.rpc.responses import (
    GetTokenAccountBalanceResp,
    GetTokenAccountsByDelegateJsonParsedResp,
    GetTokenAccountsByDelegateResp,
    GetTokenAccountsByOwnerJsonParsedResp,
    GetTokenAccountsByOwnerResp,
    SendTransactionResp,
)

import spl.token.instructions as spl_token
from solana.rpc.async_api import AsyncClient
from solana.rpc.commitment import Commitment
from solana.rpc.types import TxOpts
from spl.token._layouts import ACCOUNT_LAYOUT, MINT_LAYOUT, MULTISIG_LAYOUT
from spl.token.core import AccountInfo, MintInfo, _TokenCore


class AsyncToken(_TokenCore):  # pylint: disable=too-many-public-methods
    """An ERC20-like Token."""

    def __init__(self, conn: AsyncClient, pubkey: Pubkey, program_id: Pubkey, payer: Keypair) -> None:
        """Initialize a client to a SPL-Token program."""
        super().__init__(pubkey, program_id, payer)
        self._conn = conn

    @staticmethod
    async def get_min_balance_rent_for_exempt_for_account(conn: AsyncClient) -> int:
        """Get the minimum balance for the account to be rent exempt.

        Args:
            conn: RPC connection to a solana cluster.

        Returns:
            Number of lamports required.
        """
        resp = await conn.get_minimum_balance_for_rent_exemption(ACCOUNT_LAYOUT.sizeof())
        return resp.value

    @staticmethod
    async def get_min_balance_rent_for_exempt_for_mint(conn: AsyncClient) -> int:
        """Get the minimum balance for the mint to be rent exempt.

        Args:
            conn: RPC connection to a solana cluster.

        Returns:
            Number of lamports required.
        """
        resp = await conn.get_minimum_balance_for_rent_exemption(MINT_LAYOUT.sizeof())
        return resp.value

    @staticmethod
    async def get_min_balance_rent_for_exempt_for_multisig(conn: AsyncClient) -> int:
        """Get the minimum balance for the multisig to be rent exempt.

        Args:
            conn: RPC connection to a solana cluster.

        Returns:
             Number of lamports required.
        """
        resp = await conn.get_minimum_balance_for_rent_exemption(MULTISIG_LAYOUT.sizeof())
        return resp.value

    async def get_accounts_by_owner(
        self,
        owner: Pubkey,
        commitment: Optional[Commitment] = None,
        encoding: str = "base64",
    ) -> GetTokenAccountsByOwnerResp:
        """Get token accounts of the provided owner.

        Args:
            owner: Public Key of the token account owner.
            commitment: (optional) Bank state to query.
            encoding: (optional) Encoding for Account data, either "base58" (slow) or "base64".
        """
        args = self._get_accounts_args(
            owner,
            commitment,
            encoding,
            self._conn.commitment,  # pylint: disable=protected-access
        )
        return await self._conn.get_token_accounts_by_owner(*args)

    async def get_accounts_by_owner_json_parsed(
        self,
        owner: Pubkey,
        commitment: Optional[Commitment] = None,
    ) -> GetTokenAccountsByOwnerJsonParsedResp:
        """Get token accounts of the provided owner by the token's mint, in JSON format.

        Args:
            owner: Public Key of the token account owner.
            commitment: (optional) Bank state to query.


        Parsed-JSON encoding attempts to use program-specific state parsers to return more
        human-readable and explicit account state data. If parsed-JSON is requested but a
        valid mint cannot be found for a particular account, that account will be filtered out
        from results. jsonParsed encoding is UNSTABLE.
        """
        args = self._get_accounts_args(
            owner,
            commitment,
            "jsonParsed",
            self._conn.commitment,  # pylint: disable=protected-access
        )
        return await self._conn.get_token_accounts_by_owner_json_parsed(*args)

    async def get_accounts_by_delegate(
        self,
        owner: Pubkey,
        commitment: Optional[Commitment] = None,
        encoding: str = "base64",
    ) -> GetTokenAccountsByDelegateResp:
        """Get token accounts of the provided delegate.

        Args:
            owner: Public Key of the delegate account.
            commitment: (optional) Bank state to query.
            encoding: (optional) Encoding for Account data, either "base58" (slow) or "base64".
        """
        args = self._get_accounts_args(
            owner,
            commitment,
            encoding,
            self._conn.commitment,  # pylint: disable=protected-access
        )
        return await self._conn.get_token_accounts_by_delegate(*args)

    async def get_accounts_by_delegate_json_parsed(
        self,
        owner: Pubkey,
        commitment: Optional[Commitment] = None,
        encoding: str = "base64",
    ) -> GetTokenAccountsByDelegateJsonParsedResp:
        """Get token accounts of the provided delegate, in JSON format.

        Args:
            owner: Public Key of the delegate account.
            commitment: (optional) Bank state to query.
            encoding: (optional) Encoding for Account data, either "base58" (slow) or "base64".

        Parsed-JSON encoding attempts to use program-specific state parsers to return more
        human-readable and explicit account state data. If parsed-JSON is requested but a
        valid mint cannot be found for a particular account, that account will be filtered out
        from results. jsonParsed encoding is UNSTABLE.
        """
        args = self._get_accounts_args(
            owner,
            commitment,
            encoding,
            self._conn.commitment,  # pylint: disable=protected-access
        )
        return await self._conn.get_token_accounts_by_delegate_json_parsed(*args)

    async def get_balance(self, pubkey: Pubkey, commitment: Optional[Commitment] = None) -> GetTokenAccountBalanceResp:
        """Get the balance of the provided token account.

        Args:
            pubkey: Public Key of the token account.
            commitment: (optional) Bank state to query.
        """
        return await self._conn.get_token_account_balance(pubkey, commitment)

    @classmethod
    async def create_mint(
        cls,
        conn: AsyncClient,
        payer: Keypair,
        mint_authority: Pubkey,
        decimals: int,
        program_id: Pubkey,
        freeze_authority: Optional[Pubkey] = None,
        skip_confirmation: bool = False,
        recent_blockhash: Optional[Blockhash] = None,
    ) -> AsyncToken:
        """Create and initialize a token.

        Args:
            conn: RPC connection to a solana cluster.
            payer: Fee payer for transaction.
            mint_authority: Account or multisig that will control minting.
            decimals: Location of the decimal place.
            program_id: SPL Token program account.
            freeze_authority: (optional) Account or multisig that can freeze token accounts.
            skip_confirmation: (optional) Option to skip transaction confirmation.
            recent_blockhash: (optional) a prefetched Blockhash for the transaction.

        Returns:
            Token object for the newly minted token.

        If skip confirmation is set to `False`, this method will block for at most 30 seconds
        or until the transaction is confirmed.
        """
        # Allocate memory for the account
        balance_needed = await AsyncToken.get_min_balance_rent_for_exempt_for_mint(conn)
        # Construct transaction
        recent_blockhash_to_use = (
            (await conn.get_latest_blockhash()).value.blockhash if recent_blockhash is None else recent_blockhash
        )
        token, txn, opts = _TokenCore._create_mint_args(
            conn,
            payer,
            mint_authority,
            decimals,
            program_id,
            freeze_authority,
            skip_confirmation,
            balance_needed,
            cls,
            conn.commitment,
            recent_blockhash_to_use,
        )
        # Send the two instructions
        await conn.send_transaction(txn, opts=opts)
        return cast(AsyncToken, token)

    async def create_account(
        self,
        owner: Pubkey,
        skip_confirmation: bool = False,
        recent_blockhash: Optional[Blockhash] = None,
    ) -> Pubkey:
        """Create and initialize a new account.

        This account may then be used as a `transfer()` or `approve()` destination.

        Args:
            owner: User account that will own the new account.
            skip_confirmation: (optional) Option to skip transaction confirmation.
            recent_blockhash (optional): A prefetched blockhash for the transaction.

        Returns:
            Public key of the new empty account.

        If skip confirmation is set to `False`, this method will block for at most 30 seconds
        or until the transaction is confirmed.
        """
        balance_needed = await AsyncToken.get_min_balance_rent_for_exempt_for_account(self._conn)
        recent_blockhash_to_use = (
            (await self._conn.get_latest_blockhash()).value.blockhash if recent_blockhash is None else recent_blockhash
        )
        new_account_pk, txn, opts = self._create_account_args(
            owner, skip_confirmation, balance_needed, self._conn.commitment, recent_blockhash_to_use
        )
        # Send the two instructions
        await self._conn.send_transaction(txn, opts=opts)
        return new_account_pk

    async def create_associated_token_account(
        self,
        owner: Pubkey,
        skip_confirmation: bool = False,
        recent_blockhash: Optional[Blockhash] = None,
    ) -> Pubkey:
        """Create an associated token account.

        Args:
            owner: User account that will own the associated token account.
            skip_confirmation: (optional) Option to skip transaction confirmation.
            recent_blockhash (optional): A prefetched blockhash for the transaction.

        Returns:
            Public key of the new associated account.

        If skip confirmation is set to `False`, this method will block for at most 30 seconds
        or until the transaction is confirmed.
        """
        # Construct transaction
        recent_blockhash_to_use = (
            (await self._conn.get_latest_blockhash()).value.blockhash if recent_blockhash is None else recent_blockhash
        )
        public_key, txn, payer, opts = self._create_associated_token_account_args(
            owner, skip_confirmation, self._conn.commitment, recent_blockhash_to_use, token_program_id=self.program_id
        )
        await self._conn.send_transaction(txn, opts=opts)
        return public_key

    @staticmethod
    async def create_wrapped_native_account(
        conn: AsyncClient,
        program_id: Pubkey,
        owner: Pubkey,
        payer: Keypair,
        amount: int,
        skip_confirmation: bool = False,
        recent_blockhash: Optional[Blockhash] = None,
    ) -> Pubkey:
        """Create and initialize a new account on the special native token mint.

        Args:
            conn: RPC connection to a solana cluster.
            program_id: SPL Token program account.
            owner: The owner of the new token account.
            payer: The source of the lamports to initialize, and payer of the initialization fees.
            amount: The amount of lamports to wrap.
            skip_confirmation: (optional) Option to skip transaction confirmation.
            recent_blockhash: (optional) a prefetched Blockhash for the transaction.

        Returns:
            The new token account.

        If skip confirmation is set to `False`, this method will block for at most 30 seconds
        or until the transaction is confirmed.
        """
        # Allocate memory for the account
        balance_needed = await AsyncToken.get_min_balance_rent_for_exempt_for_account(conn)
        recent_blockhash_to_use = (
            (await conn.get_latest_blockhash()).value.blockhash if recent_blockhash is None else recent_blockhash
        )
        (
            new_account_public_key,
            txn,
            payer,
            new_account,
            opts,
        ) = _TokenCore._create_wrapped_native_account_args(
            program_id,
            owner,
            payer,
            amount,
            skip_confirmation,
            balance_needed,
            conn.commitment,
            recent_blockhash_to_use,
        )
        await conn.send_transaction(txn, opts=opts)
        return new_account_public_key

    async def create_multisig(
        self,
        m: int,
        multi_signers: List[Pubkey],
        opts: Optional[TxOpts] = None,
        recent_blockhash: Optional[Blockhash] = None,
    ) -> Pubkey:  # pylint: disable=invalid-name
        """Create and initialize a new multisig.

        Args:
            m: Number of required signatures.
            multi_signers: Full set of signers.
            opts: (optional) Transaction options.
            recent_blockhash: (optional) a prefetched Blockhash for the transaction.

        Returns:
            Public key of the new multisig account.
        """
        balance_needed = await AsyncToken.get_min_balance_rent_for_exempt_for_multisig(self._conn)
        recent_blockhash_to_use = (
            (await self._conn.get_latest_blockhash()).value.blockhash if recent_blockhash is None else recent_blockhash
        )
        txn, multisig = self._create_multisig_args(m, multi_signers, balance_needed, recent_blockhash_to_use)
        opts_to_use = TxOpts(preflight_commitment=self._conn.commitment) if opts is None else opts
        await self._conn.send_transaction(txn, opts=opts_to_use)
        return multisig.pubkey()

    async def get_mint_info(self) -> MintInfo:
        """Retrieve mint information."""
        info = await self._conn.get_account_info(self.pubkey)
        return self._create_mint_info(info)

    async def get_account_info(self, account: Pubkey, commitment: Optional[Commitment] = None) -> AccountInfo:
        """Retrieve account information."""
        info = await self._conn.get_account_info(account, commitment)
        return self._create_account_info(info)

    async def transfer(
        self,
        source: Pubkey,
        dest: Pubkey,
        owner: Union[Keypair, Pubkey],
        amount: int,
        multi_signers: Optional[List[Keypair]] = None,
        opts: Optional[TxOpts] = None,
        recent_blockhash: Optional[Blockhash] = None,
    ) -> SendTransactionResp:
        """Transfer tokens to another account.

        Args:
            source: Public key of account to transfer tokens from.
            dest: Public key of account to transfer tokens to.
            owner: Owner of the source account.
            amount: Number of tokens to transfer.
            multi_signers: (optional) Signing accounts if `owner` is a multiSig.
            opts: (optional) Transaction options.
            recent_blockhash: (optional) a prefetched Blockhash for the transaction.
        """
        opts_to_use = TxOpts(preflight_commitment=self._conn.commitment) if opts is None else opts
        recent_blockhash_to_use = (
            (await self._conn.get_latest_blockhash()).value.blockhash if recent_blockhash is None else recent_blockhash
        )
        txn, opts = self._transfer_args(
            source, dest, owner, amount, multi_signers, opts_to_use, recent_blockhash_to_use
        )
        return await self._conn.send_transaction(txn, opts=opts)

    async def approve(
        self,
        source: Pubkey,
        delegate: Pubkey,
        owner: Pubkey,
        amount: int,
        multi_signers: Optional[List[Keypair]] = None,
        opts: Optional[TxOpts] = None,
        recent_blockhash: Optional[Blockhash] = None,
    ) -> SendTransactionResp:
        """Grant a third-party permission to transfer up the specified number of tokens from an account.

        Args:
            source: Public key of the source account.
            delegate: Account authorized to perform a transfer tokens from the source account.
            owner: Owner of the source account.
            amount: Maximum number of tokens the delegate may transfer.
            multi_signers: (optional) Signing accounts if `owner` is a multiSig.
            opts: (optional) Transaction options.
            recent_blockhash: (optional) a prefetched Blockhash for the transaction.
        """
        opts_to_use = TxOpts(preflight_commitment=self._conn.commitment) if opts is None else opts
        recent_blockhash_to_use = (
            (await self._conn.get_latest_blockhash()).value.blockhash if recent_blockhash is None else recent_blockhash
        )
        txn, payer, signers, opts = self._approve_args(
            source, delegate, owner, amount, multi_signers, opts_to_use, recent_blockhash_to_use
        )
        return await self._conn.send_transaction(txn, opts=opts)

    async def revoke(
        self,
        account: Pubkey,
        owner: Pubkey,
        multi_signers: Optional[List[Keypair]] = None,
        opts: Optional[TxOpts] = None,
        recent_blockhash: Optional[Blockhash] = None,
    ) -> SendTransactionResp:
        """Revoke transfer authority for a given account.

        Args:
            account: Source account for which transfer authority is being revoked.
            owner: Owner of the source account.
            multi_signers: (optional) Signing accounts if `owner` is a multisig.
            opts: (optional) Transaction options.
            recent_blockhash: (optional) a prefetched Blockhash for the transaction.
        """
        opts_to_use = TxOpts(preflight_commitment=self._conn.commitment) if opts is None else opts
        recent_blockhash_to_use = (
            (await self._conn.get_latest_blockhash()).value.blockhash if recent_blockhash is None else recent_blockhash
        )
        txn, payer, signers, opts = self._revoke_args(
            account, owner, multi_signers, opts_to_use, recent_blockhash_to_use
        )
        return await self._conn.send_transaction(txn, opts=opts)

    async def set_authority(
        self,
        account: Pubkey,
        current_authority: Union[Keypair, Pubkey],
        authority_type: spl_token.AuthorityType,
        new_authority: Optional[Pubkey] = None,
        multi_signers: Optional[List[Keypair]] = None,
        opts: Optional[TxOpts] = None,
        recent_blockhash: Optional[Blockhash] = None,
    ) -> SendTransactionResp:
        """Assign a new authority to the account.

        Args:
            account: Public key of the token account.
            current_authority: Current authority of the account.
            authority_type: Type of authority to set.
            new_authority: (optional) New authority of the account.
            multi_signers: (optional) Signing accounts if `owner` is a multiSig.
            opts: (optional) Transaction options.
            recent_blockhash: (optional) a prefetched Blockhash for the transaction.
        """
        opts_to_use = TxOpts(preflight_commitment=self._conn.commitment) if opts is None else opts
        recent_blockhash_to_use = (
            (await self._conn.get_latest_blockhash()).value.blockhash if recent_blockhash is None else recent_blockhash
        )
        txn, payer, signers, opts = self._set_authority_args(
            account,
            current_authority,
            authority_type,
            new_authority,
            multi_signers,
            opts_to_use,
            recent_blockhash_to_use,
        )
        return await self._conn.send_transaction(txn, opts=opts)

    async def mint_to(
        self,
        dest: Pubkey,
        mint_authority: Union[Keypair, Pubkey],
        amount: int,
        multi_signers: Optional[List[Keypair]] = None,
        opts: Optional[TxOpts] = None,
        recent_blockhash: Optional[Blockhash] = None,
    ) -> SendTransactionResp:
        """Mint new tokens.

        Args:
            dest: Public key of the account to mint to.
            mint_authority: Public key of the minting authority.
            amount: Amount to mint.
            multi_signers: (optional) Signing accounts if `owner` is a multisig.
            opts: (optional) Transaction options.
            recent_blockhash: (optional) a prefetched Blockhash for the transaction.

        If skip confirmation is set to `False`, this method will block for at most 30 seconds
        or until the transaction is confirmed.
        """
        opts_to_use = TxOpts(preflight_commitment=self._conn.commitment) if opts is None else opts
        recent_blockhash_to_use = (
            (await self._conn.get_latest_blockhash()).value.blockhash if recent_blockhash is None else recent_blockhash
        )
        txn, opts = self._mint_to_args(
            dest, mint_authority, amount, multi_signers, opts_to_use, recent_blockhash_to_use
        )
        return await self._conn.send_transaction(txn, opts=opts)

    async def burn(
        self,
        account: Pubkey,
        owner: Pubkey,
        amount: int,
        multi_signers: Optional[List[Keypair]] = None,
        opts: Optional[TxOpts] = None,
        recent_blockhash: Optional[Blockhash] = None,
    ) -> SendTransactionResp:
        """Burn tokens.

        Args:
            account: Account to burn tokens from.
            owner: Owner of the account.
            amount: Amount to burn.
            multi_signers: (optional) Signing accounts if `owner` is a multiSig.
            opts: (optional) Transaction options.
            recent_blockhash: (optional) a prefetched Blockhash for the transaction.
        """
        opts_to_use = TxOpts(preflight_commitment=self._conn.commitment) if opts is None else opts
        recent_blockhash_to_use = (
            (await self._conn.get_latest_blockhash()).value.blockhash if recent_blockhash is None else recent_blockhash
        )
        txn, opts = self._burn_args(account, owner, amount, multi_signers, opts_to_use, recent_blockhash_to_use)
        return await self._conn.send_transaction(txn, opts=opts)

    async def close_account(
        self,
        account: Pubkey,
        dest: Pubkey,
        authority: Pubkey,
        multi_signers: Optional[List[Keypair]] = None,
        opts: Optional[TxOpts] = None,
        recent_blockhash: Optional[Blockhash] = None,
    ) -> SendTransactionResp:
        """Remove approval for the transfer of any remaining tokens.

        Args:
            account: Account to close.
            dest: Account to receive the remaining balance of the closed account.
            authority: Authority which is allowed to close the account.
            multi_signers: (optional) Signing accounts if `owner` is a multiSig.
            opts: (optional) Transaction options.
            recent_blockhash: (optional) a prefetched Blockhash for the transaction.
        """
        opts_to_use = TxOpts(preflight_commitment=self._conn.commitment) if opts is None else opts
        recent_blockhash_to_use = (
            (await self._conn.get_latest_blockhash()).value.blockhash if recent_blockhash is None else recent_blockhash
        )
        txn, opts = self._close_account_args(
            account, dest, authority, multi_signers, opts_to_use, recent_blockhash_to_use
        )
        return await self._conn.send_transaction(txn, opts=opts)

    async def freeze_account(
        self,
        account: Pubkey,
        authority: Pubkey,
        multi_signers: Optional[List[Keypair]] = None,
        opts: Optional[TxOpts] = None,
        recent_blockhash: Optional[Blockhash] = None,
    ) -> SendTransactionResp:
        """Freeze account.

        Args:
            account: Account to freeze.
            authority: The mint freeze authority.
            multi_signers: (optional) Signing accounts if `authority` is a multiSig.
            opts: (optional) Transaction options.
            recent_blockhash: (optional) a prefetched Blockhash for the transaction.
        """
        opts_to_use = TxOpts(preflight_commitment=self._conn.commitment) if opts is None else opts
        recent_blockhash_to_use = (
            (await self._conn.get_latest_blockhash()).value.blockhash if recent_blockhash is None else recent_blockhash
        )
        txn, opts = self._freeze_account_args(account, authority, multi_signers, opts_to_use, recent_blockhash_to_use)
        return await self._conn.send_transaction(txn, opts=opts)

    async def thaw_account(
        self,
        account: Pubkey,
        authority: Pubkey,
        multi_signers: Optional[List[Keypair]] = None,
        opts: Optional[TxOpts] = None,
        recent_blockhash: Optional[Blockhash] = None,
    ) -> SendTransactionResp:
        """Thaw account.

        Args:
            account: Account to thaw.
            authority: The mint freeze authority.
            multi_signers: (optional) Signing accounts if `authority` is a multiSig.
            opts: (optional) Transaction options.
            recent_blockhash: (optional) a prefetched Blockhash for the transaction.
        """
        opts_to_use = TxOpts(preflight_commitment=self._conn.commitment) if opts is None else opts
        recent_blockhash_to_use = (
            (await self._conn.get_latest_blockhash()).value.blockhash if recent_blockhash is None else recent_blockhash
        )
        txn, opts = self._thaw_account_args(account, authority, multi_signers, opts_to_use, recent_blockhash_to_use)
        return await self._conn.send_transaction(txn, opts=opts)

    async def transfer_checked(
        self,
        source: Pubkey,
        dest: Pubkey,
        owner: Pubkey,
        amount: int,
        decimals: int,
        multi_signers: Optional[List[Keypair]],
        opts: Optional[TxOpts] = None,
        recent_blockhash: Optional[Blockhash] = None,
    ) -> SendTransactionResp:
        """Transfer tokens to another account, asserting the token mint and decimals.

        Args:
            source: Public key of account to transfer tokens from.
            dest: Public key of account to transfer tokens to.
            owner: Owner of the source account.
            amount: Number of tokens to transfer.
            decimals: Number of decimals in transfer amount.
            multi_signers: (optional) Signing accounts if `owner` is a multiSig.
            opts: (optional) Transaction options.
            recent_blockhash: (optional) a prefetched Blockhash for the transaction.
        """
        opts_to_use = TxOpts(preflight_commitment=self._conn.commitment) if opts is None else opts
        recent_blockhash_to_use = (
            (await self._conn.get_latest_blockhash()).value.blockhash if recent_blockhash is None else recent_blockhash
        )
        txn, opts = self._transfer_checked_args(
            source, dest, owner, amount, decimals, multi_signers, opts_to_use, recent_blockhash_to_use
        )
        return await self._conn.send_transaction(txn, opts=opts)

    async def approve_checked(
        self,
        source: Pubkey,
        delegate: Pubkey,
        owner: Pubkey,
        amount: int,
        decimals: int,
        multi_signers: Optional[List[Keypair]] = None,
        opts: Optional[TxOpts] = None,
        recent_blockhash: Optional[Blockhash] = None,
    ) -> SendTransactionResp:
        """Grant a third-party permission to transfer up the specified number of tokens from an account.

        This method also asserts the token mint and decimals.

        Args:
            source: Public key of the source account.
            delegate: Account authorized to perform a transfer tokens from the source account.
            owner: Owner of the source account.
            amount: Maximum number of tokens the delegate may transfer.
            decimals: Number of decimals in approve amount.
            multi_signers: (optional) Signing accounts if `owner` is a multisig.
            opts: (optional) Transaction options.
            recent_blockhash (optional): A prefetched blockhash for the transaction.
        """
        opts_to_use = TxOpts(preflight_commitment=self._conn.commitment) if opts is None else opts
        recent_blockhash_to_use = (
            (await self._conn.get_latest_blockhash()).value.blockhash if recent_blockhash is None else recent_blockhash
        )
        txn, opts = self._approve_checked_args(
            source, delegate, owner, amount, decimals, multi_signers, opts_to_use, recent_blockhash_to_use
        )
        return await self._conn.send_transaction(txn, opts=opts)

    async def mint_to_checked(
        self,
        dest: Pubkey,
        mint_authority: Pubkey,
        amount: int,
        decimals: int,
        multi_signers: Optional[List[Keypair]] = None,
        opts: Optional[TxOpts] = None,
        recent_blockhash: Optional[Blockhash] = None,
    ) -> SendTransactionResp:
        """Mint new tokens, asserting the token mint and decimals.

        Args:
            dest: Public key of the account to mint to.
            mint_authority: Public key of the minting authority.
            amount: Amount to mint.
            decimals: Number of decimals in amount to mint.
            multi_signers: (optional) Signing accounts if `owner` is a multiSig.
            opts: (optional) Transaction options.
            recent_blockhash (optional): A prefetched blockhash for the transaction.
        """
        opts_to_use = TxOpts(preflight_commitment=self._conn.commitment) if opts is None else opts
        recent_blockhash_to_use = (
            (await self._conn.get_latest_blockhash()).value.blockhash if recent_blockhash is None else recent_blockhash
        )
        txn, opts = self._mint_to_checked_args(
            dest, mint_authority, amount, decimals, multi_signers, opts_to_use, recent_blockhash_to_use
        )
        return await self._conn.send_transaction(txn, opts=opts)

    async def burn_checked(
        self,
        account: Pubkey,
        owner: Pubkey,
        amount: int,
        decimals: int,
        multi_signers: Optional[List[Keypair]] = None,
        opts: Optional[TxOpts] = None,
        recent_blockhash: Optional[Blockhash] = None,
    ) -> SendTransactionResp:
        """Burn tokens, asserting the token mint and decimals.

        Args:
            account: Account to burn tokens from.
            owner: Owner of the account.
            amount: Amount to burn.
            decimals: Number of decimals in amount to burn.
            multi_signers: (optional) Signing accounts if `owner` is a multisig.
            opts: (optional) Transaction options.
            recent_blockhash: (optional) a prefetched Blockhash for the transaction.
        """
        opts_to_use = TxOpts(preflight_commitment=self._conn.commitment) if opts is None else opts
        recent_blockhash_to_use = (
            (await self._conn.get_latest_blockhash()).value.blockhash if recent_blockhash is None else recent_blockhash
        )
        txn, opts = self._burn_checked_args(
            account,
            owner,
            amount,
            decimals,
            multi_signers,
            opts_to_use,
            recent_blockhash_to_use,
        )
        return await self._conn.send_transaction(txn, opts=opts)
