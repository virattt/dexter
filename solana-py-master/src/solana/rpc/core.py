# pylint: disable=too-many-arguments
"""Helper code for api.py and async_api.py."""

from typing import List, Optional, Sequence, Tuple, Union, overload

from solders.account_decoder import UiAccountEncoding, UiDataSliceConfig
from solders.commitment_config import CommitmentLevel
from solders.hash import Hash as Blockhash
from solders.message import MessageV0, VersionedMessage
from solders.pubkey import Pubkey
from solders.rpc.config import (
    RpcAccountInfoConfig,
    RpcBlockConfig,
    RpcContextConfig,
    RpcEpochConfig,
    RpcGetVoteAccountsConfig,
    RpcLargestAccountsFilter,
    RpcLeaderScheduleConfig,
    RpcProgramAccountsConfig,
    RpcRequestAirdropConfig,
    RpcSendTransactionConfig,
    RpcSignaturesForAddressConfig,
    RpcSignatureStatusConfig,
    RpcSimulateTransactionConfig,
    RpcSimulateTransactionAccountsConfig,
    RpcSupplyConfig,
    RpcTokenAccountsFilterMint,
    RpcTokenAccountsFilterProgramId,
    RpcTransactionConfig,
)
from solders.rpc.errors import InvalidParamsMessage
from solders.rpc.filter import Memcmp
from solders.rpc.requests import (
    GetAccountInfo,
    GetBalance,
    GetBlock,
    GetBlockCommitment,
    GetBlockHeight,
    GetBlocks,
    GetBlockTime,
    GetClusterNodes,
    GetEpochInfo,
    GetEpochSchedule,
    GetFeeForMessage,
    GetFirstAvailableBlock,
    GetGenesisHash,
    GetHealth,
    GetIdentity,
    GetInflationGovernor,
    GetInflationRate,
    GetInflationReward,
    GetLargestAccounts,
    GetLatestBlockhash,
    GetLeaderSchedule,
    GetMinimumBalanceForRentExemption,
    GetMultipleAccounts,
    GetProgramAccounts,
    GetRecentPerformanceSamples,
    GetSignaturesForAddress,
    GetSignatureStatuses,
    GetSlot,
    GetSlotLeader,
    GetSlotLeaders,
    GetStakeActivation,
    GetSupply,
    GetTokenAccountBalance,
    GetTokenAccountsByDelegate,
    GetTokenAccountsByOwner,
    GetTokenLargestAccounts,
    GetTokenSupply,
    GetTransaction,
    GetTransactionCount,
    GetVersion,
    GetVoteAccounts,
    MinimumLedgerSlot,
    RequestAirdrop,
    SendRawTransaction,
    SimulateLegacyTransaction,
    SimulateVersionedTransaction,
    ValidatorExit,
)
from solders.rpc.responses import GetLatestBlockhashResp, SendTransactionResp
from solders.signature import Signature
from solders.transaction import Transaction, VersionedTransaction
from solders.transaction_status import UiTransactionEncoding

from solana.rpc import types

from .commitment import Commitment, Confirmed, Finalized, Processed

_COMMITMENT_TO_SOLDERS = {
    Finalized: CommitmentLevel.Finalized,
    Confirmed: CommitmentLevel.Confirmed,
    Processed: CommitmentLevel.Processed,
}
_TX_ENCODING_TO_SOLDERS = {
    "binary": UiTransactionEncoding.Binary,
    "base58": UiTransactionEncoding.Base58,
    "base64": UiTransactionEncoding.Base64,
    "json": UiTransactionEncoding.Json,
    "jsonParsed": UiTransactionEncoding.JsonParsed,
}
_ACCOUNT_ENCODING_TO_SOLDERS = {
    "binary": UiAccountEncoding.Binary,
    "base58": UiAccountEncoding.Base58,
    "base64": UiAccountEncoding.Base64,
    "jsonParsed": UiAccountEncoding.JsonParsed,
    "base64+zstd": UiAccountEncoding.Base64Zstd,
}
_LARGEST_ACCOUNTS_FILTER_TO_SOLDERS = {
    "circulating": RpcLargestAccountsFilter.Circulating,
    "nonCirculating": RpcLargestAccountsFilter.NonCirculating,
}


class RPCException(Exception):
    """Raised when RPC method returns an error result."""


class RPCNoResultException(Exception):
    """Raised when an RPC method returns no result."""


class UnconfirmedTxError(Exception):
    """Raise when confirming a transaction times out."""


class TransactionExpiredBlockheightExceededError(Exception):
    """Raise when confirming an expired transaction that exceeded the blockheight."""


class _ClientCore:  # pylint: disable=too-few-public-methods
    _comm_key = "commitment"
    _encoding_key = "encoding"
    _data_slice_key = "dataSlice"
    _skip_preflight_key = "skipPreflight"
    _preflight_comm_key = "preflightCommitment"
    _max_retries = "maxRetries"
    _before_rpc_config_key = "before"
    _limit_rpc_config_key = "limit"
    _until_rpc_config_key = "until"
    _get_cluster_nodes = GetClusterNodes()
    _get_epoch_schedule = GetEpochSchedule()
    _get_first_available_block = GetFirstAvailableBlock()
    _get_genesis_hash = GetGenesisHash()
    _get_identity = GetIdentity()
    _get_inflation_rate = GetInflationRate()
    _minimum_ledger_slot = MinimumLedgerSlot()
    _get_version = GetVersion()
    _validator_exit = ValidatorExit()

    def __init__(
        self,
        commitment: Optional[Commitment] = None,
    ):
        self._commitment = commitment or Finalized

    @property
    def commitment(self) -> Commitment:
        """The default commitment used for requests."""
        return self._commitment

    def _get_health_body(self) -> GetHealth:
        return GetHealth()

    def _get_balance_body(self, pubkey: Pubkey, commitment: Optional[Commitment]) -> GetBalance:
        commitment_to_use = _COMMITMENT_TO_SOLDERS[commitment or self._commitment]
        return GetBalance(pubkey, RpcContextConfig(commitment=commitment_to_use))

    def _get_account_info_body(
        self,
        pubkey: Pubkey,
        commitment: Optional[Commitment],
        encoding: str,
        data_slice: Optional[types.DataSliceOpts],
    ) -> GetAccountInfo:
        data_slice_to_use = (
            None if data_slice is None else UiDataSliceConfig(offset=data_slice.offset, length=data_slice.length)
        )
        encoding_to_use = _ACCOUNT_ENCODING_TO_SOLDERS[encoding]
        commitment_to_use = _COMMITMENT_TO_SOLDERS[commitment or self._commitment]
        config = RpcAccountInfoConfig(
            encoding=encoding_to_use,
            data_slice=data_slice_to_use,
            commitment=commitment_to_use,
        )
        return GetAccountInfo(pubkey, config)

    @staticmethod
    def _get_block_commitment_body(slot: int) -> GetBlockCommitment:
        return GetBlockCommitment(slot)

    @staticmethod
    def _get_block_time_body(slot: int) -> GetBlockTime:
        return GetBlockTime(slot)

    @staticmethod
    def _get_block_body(slot: int, encoding: str, max_supported_transaction_version: Optional[int]) -> GetBlock:
        encoding_to_use = _TX_ENCODING_TO_SOLDERS[encoding]
        config = RpcBlockConfig(
            encoding=encoding_to_use,
            max_supported_transaction_version=max_supported_transaction_version,
        )
        return GetBlock(slot=slot, config=config)

    def _get_block_height_body(self, commitment: Optional[Commitment]) -> GetBlockHeight:
        commitment_to_use = _COMMITMENT_TO_SOLDERS[commitment or self._commitment]
        return GetBlockHeight(RpcContextConfig(commitment=commitment_to_use))

    @staticmethod
    def _get_recent_performance_samples_body(
        limit: Optional[int],
    ) -> GetRecentPerformanceSamples:
        return GetRecentPerformanceSamples(limit)

    @staticmethod
    def _get_blocks_body(start_slot: int, end_slot: Optional[int]) -> GetBlocks:
        return GetBlocks(start_slot, end_slot)

    def _get_signatures_for_address_body(
        self,
        address: Pubkey,
        before: Optional[Signature],
        until: Optional[Signature],
        limit: Optional[int],
        commitment: Optional[Commitment],
    ) -> GetSignaturesForAddress:
        commitment_to_use = _COMMITMENT_TO_SOLDERS[commitment or self._commitment]
        config = RpcSignaturesForAddressConfig(before=before, until=until, limit=limit, commitment=commitment_to_use)
        return GetSignaturesForAddress(address, config)

    def _get_transaction_body(
        self,
        tx_sig: Signature,
        encoding: str = "json",
        commitment: Union[Commitment, None] = None,
        max_supported_transaction_version: Optional[int] = None,
    ) -> GetTransaction:
        commitment_to_use = _COMMITMENT_TO_SOLDERS[commitment or self._commitment]
        encoding_to_use = _TX_ENCODING_TO_SOLDERS[encoding]
        config = RpcTransactionConfig(
            encoding=encoding_to_use,
            commitment=commitment_to_use,
            max_supported_transaction_version=max_supported_transaction_version,
        )
        return GetTransaction(tx_sig, config)

    def _get_epoch_info_body(self, commitment: Optional[Commitment]) -> GetEpochInfo:
        commitment_to_use = _COMMITMENT_TO_SOLDERS[commitment or self._commitment]
        config = RpcContextConfig(commitment=commitment_to_use)
        return GetEpochInfo(config)

    def _get_fee_for_message_body(
        self, message: VersionedMessage, commitment: Optional[Commitment]
    ) -> GetFeeForMessage:
        commitment_to_use = _COMMITMENT_TO_SOLDERS[commitment or self._commitment]
        # weird mypy hack:
        if isinstance(message, MessageV0):
            return GetFeeForMessage(message, commitment_to_use)
        return GetFeeForMessage(message, commitment_to_use)

    def _get_inflation_governor_body(self, commitment: Optional[Commitment]) -> GetInflationGovernor:
        commitment_to_use = _COMMITMENT_TO_SOLDERS[commitment or self._commitment]
        return GetInflationGovernor(commitment_to_use)

    def _get_largest_accounts_body(
        self, filter_opt: Optional[str], commitment: Optional[Commitment]
    ) -> GetLargestAccounts:
        filter_to_use = None if filter_opt is None else _LARGEST_ACCOUNTS_FILTER_TO_SOLDERS[filter_opt]
        commitment_to_use = _COMMITMENT_TO_SOLDERS[commitment or self._commitment]
        return GetLargestAccounts(commitment=commitment_to_use, filter_=filter_to_use)

    def _get_leader_schedule_body(self, slot: Optional[int], commitment: Optional[Commitment]) -> GetLeaderSchedule:
        commitment_to_use = _COMMITMENT_TO_SOLDERS[commitment or self._commitment]
        config = RpcLeaderScheduleConfig(commitment=commitment_to_use)
        return GetLeaderSchedule(slot, config)

    def _get_minimum_balance_for_rent_exemption_body(
        self, usize: int, commitment: Optional[Commitment]
    ) -> GetMinimumBalanceForRentExemption:
        commitment_to_use = _COMMITMENT_TO_SOLDERS[commitment or self._commitment]
        return GetMinimumBalanceForRentExemption(usize, commitment_to_use)

    def _get_multiple_accounts_body(
        self,
        pubkeys: List[Pubkey],
        commitment: Optional[Commitment],
        encoding: str,
        data_slice: Optional[types.DataSliceOpts],
    ) -> GetMultipleAccounts:
        encoding_to_use = _ACCOUNT_ENCODING_TO_SOLDERS[encoding]
        commitment_to_use = _COMMITMENT_TO_SOLDERS[commitment or self._commitment]
        data_slice_to_use = (
            None if data_slice is None else UiDataSliceConfig(offset=data_slice.offset, length=data_slice.length)
        )
        config = RpcAccountInfoConfig(
            encoding=encoding_to_use,
            commitment=commitment_to_use,
            data_slice=data_slice_to_use,
        )
        return GetMultipleAccounts(pubkeys, config)

    def _get_program_accounts_body(
        self,
        pubkey: Pubkey,
        commitment: Optional[Commitment],
        encoding: Optional[str],
        data_slice: Optional[types.DataSliceOpts],
        filters: Optional[Sequence[Union[int, types.MemcmpOpts]]] = None,
    ) -> GetProgramAccounts:  # pylint: disable=too-many-arguments
        encoding_to_use = None if encoding is None else _ACCOUNT_ENCODING_TO_SOLDERS[encoding]
        commitment_to_use = _COMMITMENT_TO_SOLDERS[commitment or self._commitment]
        data_slice_to_use = (
            None if data_slice is None else UiDataSliceConfig(offset=data_slice.offset, length=data_slice.length)
        )
        account_config = RpcAccountInfoConfig(
            encoding=encoding_to_use,
            commitment=commitment_to_use,
            data_slice=data_slice_to_use,
        )
        filters_to_use: Optional[List[Union[int, Memcmp]]] = (
            None
            if filters is None
            else [x if isinstance(x, int) else Memcmp(offset=x.offset, bytes_=x.bytes) for x in filters]
        )
        config = RpcProgramAccountsConfig(account_config, filters_to_use)
        return GetProgramAccounts(pubkey, config)

    def _get_latest_blockhash_body(self, commitment: Optional[Commitment]) -> GetLatestBlockhash:
        commitment_to_use = _COMMITMENT_TO_SOLDERS[commitment or self._commitment]
        return GetLatestBlockhash(RpcContextConfig(commitment_to_use))

    @staticmethod
    def _get_signature_statuses_body(
        signatures: List[Signature], search_transaction_history: bool
    ) -> GetSignatureStatuses:
        config = RpcSignatureStatusConfig(search_transaction_history)
        return GetSignatureStatuses(signatures, config)

    def _get_slot_body(self, commitment: Optional[Commitment]) -> GetSlot:
        commitment_to_use = _COMMITMENT_TO_SOLDERS[commitment or self._commitment]
        return GetSlot(RpcContextConfig(commitment_to_use))

    def _get_slot_leader_body(self, commitment: Optional[Commitment]) -> GetSlotLeader:
        commitment_to_use = _COMMITMENT_TO_SOLDERS[commitment or self._commitment]
        return GetSlotLeader(RpcContextConfig(commitment_to_use))

    def _get_slot_leaders_body(
        self,
        start: int,
        limit: int,
    ) -> GetSlotLeaders:
        return GetSlotLeaders(
            start,
            limit,
        )

    def _get_stake_activation_body(
        self,
        pubkey: Pubkey,
        epoch: Optional[int],
        commitment: Optional[Commitment],
    ) -> GetStakeActivation:
        commitment_to_use = _COMMITMENT_TO_SOLDERS[commitment or self._commitment]
        return GetStakeActivation(pubkey, RpcEpochConfig(epoch, commitment_to_use))

    def _get_inflation_reward_body(
        self,
        pubkeys: List[Pubkey],
        epoch: Optional[int],
        commitment: Optional[Commitment],
    ) -> GetInflationReward:
        commitment_to_use = _COMMITMENT_TO_SOLDERS[commitment or self._commitment]
        return GetInflationReward(pubkeys, RpcEpochConfig(epoch, commitment_to_use))

    def _get_supply_body(self, commitment: Optional[Commitment]) -> GetSupply:
        commitment_to_use = _COMMITMENT_TO_SOLDERS[commitment or self._commitment]
        return GetSupply(
            RpcSupplyConfig(
                commitment=commitment_to_use,
                exclude_non_circulating_accounts_list=False,
            )
        )

    def _get_token_account_balance_body(
        self, pubkey: Pubkey, commitment: Optional[Commitment]
    ) -> GetTokenAccountBalance:
        commitment_to_use = _COMMITMENT_TO_SOLDERS[commitment or self._commitment]
        return GetTokenAccountBalance(pubkey, commitment_to_use)

    def _get_token_accounts_convert(
        self,
        pubkey: Pubkey,
        opts: types.TokenAccountOpts,
        commitment: Optional[Commitment],
    ) -> Tuple[
        Pubkey,
        Union[RpcTokenAccountsFilterMint, RpcTokenAccountsFilterProgramId],
        RpcAccountInfoConfig,
    ]:
        commitment_to_use = _COMMITMENT_TO_SOLDERS[commitment or self._commitment]
        encoding_to_use = _ACCOUNT_ENCODING_TO_SOLDERS[opts.encoding]
        maybe_data_slice = opts.data_slice
        data_slice_to_use = (
            None
            if maybe_data_slice is None
            else UiDataSliceConfig(offset=maybe_data_slice.offset, length=maybe_data_slice.length)
        )
        maybe_mint = opts.mint
        maybe_program_id = opts.program_id
        filter_to_use: Union[RpcTokenAccountsFilterMint, RpcTokenAccountsFilterProgramId]
        if maybe_mint is not None:
            filter_to_use = RpcTokenAccountsFilterMint(maybe_mint)
        elif maybe_program_id is not None:
            filter_to_use = RpcTokenAccountsFilterProgramId(maybe_program_id)
        else:
            raise ValueError("Please provide one of mint or program_id")
        config = RpcAccountInfoConfig(
            encoding=encoding_to_use,
            commitment=commitment_to_use,
            data_slice=data_slice_to_use,
        )
        return pubkey, filter_to_use, config

    def _get_token_accounts_by_delegate_body(
        self,
        delegate: Pubkey,
        opts: types.TokenAccountOpts,
        commitment: Optional[Commitment],
    ) -> GetTokenAccountsByDelegate:
        pubkey, filter_, config = self._get_token_accounts_convert(delegate, opts, commitment)
        return GetTokenAccountsByDelegate(pubkey, filter_, config)

    def _get_token_accounts_by_owner_body(
        self,
        owner: Pubkey,
        opts: types.TokenAccountOpts,
        commitment: Optional[Commitment],
    ) -> GetTokenAccountsByOwner:
        pubkey, filter_, config = self._get_token_accounts_convert(owner, opts, commitment)
        return GetTokenAccountsByOwner(pubkey, filter_, config)

    def _get_token_accounts_by_delegate_json_parsed_body(
        self,
        delegate: Pubkey,
        opts: types.TokenAccountOpts,
        commitment: Optional[Commitment],
    ) -> GetTokenAccountsByDelegate:
        opts_to_use = types.TokenAccountOpts(opts.mint, opts.program_id, "jsonParsed", opts.data_slice)
        pubkey, filter_, config = self._get_token_accounts_convert(delegate, opts_to_use, commitment)
        return GetTokenAccountsByDelegate(pubkey, filter_, config)

    def _get_token_accounts_by_owner_json_parsed_body(
        self,
        owner: Pubkey,
        opts: types.TokenAccountOpts,
        commitment: Optional[Commitment],
    ) -> GetTokenAccountsByOwner:
        opts_to_use = types.TokenAccountOpts(opts.mint, opts.program_id, "jsonParsed", opts.data_slice)
        pubkey, filter_, config = self._get_token_accounts_convert(owner, opts_to_use, commitment)
        return GetTokenAccountsByOwner(pubkey, filter_, config)

    def _get_token_largest_accounts_body(
        self, pubkey: Pubkey, commitment: Optional[Commitment]
    ) -> GetTokenLargestAccounts:
        commitment_to_use = _COMMITMENT_TO_SOLDERS[commitment or self._commitment]
        return GetTokenLargestAccounts(pubkey, commitment_to_use)

    def _get_token_supply_body(self, pubkey: Pubkey, commitment: Optional[Commitment]) -> GetTokenSupply:
        commitment_to_use = _COMMITMENT_TO_SOLDERS[commitment or self._commitment]
        return GetTokenSupply(pubkey, commitment_to_use)

    def _get_transaction_count_body(self, commitment: Optional[Commitment]) -> GetTransactionCount:
        commitment_to_use = _COMMITMENT_TO_SOLDERS[commitment or self._commitment]
        return GetTransactionCount(RpcContextConfig(commitment_to_use))

    def _get_vote_accounts_body(
        self,
        vote_pubkey: Optional[Pubkey] = None,
        commitment: Optional[Commitment] = None,
        keep_unstaked_delinquents: Optional[bool] = None,
        delinquent_slot_distance: Optional[int] = None,
    ) -> GetVoteAccounts:
        commitment_to_use = _COMMITMENT_TO_SOLDERS[commitment or self._commitment]
        config = RpcGetVoteAccountsConfig(
            vote_pubkey=vote_pubkey,
            commitment=commitment_to_use,
            keep_unstaked_delinquents=keep_unstaked_delinquents,
            delinquent_slot_distance=delinquent_slot_distance,
        )
        return GetVoteAccounts(config)

    def _request_airdrop_body(self, pubkey: Pubkey, lamports: int, commitment: Optional[Commitment]) -> RequestAirdrop:
        commitment_to_use = _COMMITMENT_TO_SOLDERS[commitment or self._commitment]
        return RequestAirdrop(pubkey, lamports, RpcRequestAirdropConfig(commitment=commitment_to_use))

    def _send_raw_transaction_body(self, txn: bytes, opts: types.TxOpts) -> SendRawTransaction:
        preflight_commitment_to_use = _COMMITMENT_TO_SOLDERS[opts.preflight_commitment or self._commitment]
        config = RpcSendTransactionConfig(
            skip_preflight=opts.skip_preflight,
            preflight_commitment=preflight_commitment_to_use,
            max_retries=opts.max_retries,
        )
        return SendRawTransaction(
            txn,
            config,
        )

    @staticmethod
    def _send_raw_transaction_post_send_args(
        resp: SendTransactionResp, opts: types.TxOpts
    ) -> Tuple[SendTransactionResp, Commitment, Optional[int]]:
        return resp, opts.preflight_commitment, opts.last_valid_block_height

    @overload
    def _simulate_transaction_body(
        self,
        txn: Transaction,
        sig_verify: bool,
        commitment: Optional[Commitment],
        replace_recent_blockhash: bool,
        min_context_slot: Optional[int],
        inner_instructions: bool,
        accounts_addresses: Optional[List[Pubkey]],
        accounts_encoding: str,
    ) -> SimulateLegacyTransaction: ...

    @overload
    def _simulate_transaction_body(
        self,
        txn: VersionedTransaction,
        sig_verify: bool,
        commitment: Optional[Commitment],
        replace_recent_blockhash: bool,
        min_context_slot: Optional[int],
        inner_instructions: bool,
        accounts_addresses: Optional[List[Pubkey]],
        accounts_encoding: str,
    ) -> SimulateVersionedTransaction: ...

    def _simulate_transaction_body(
        self,
        txn: Union[Transaction, VersionedTransaction],
        sig_verify: bool,
        commitment: Optional[Commitment],
        replace_recent_blockhash: bool,
        min_context_slot: Optional[int],
        inner_instructions: bool,
        accounts_addresses: Optional[Sequence[Pubkey]],
        accounts_encoding: str,
    ) -> Union[SimulateLegacyTransaction, SimulateVersionedTransaction]:
        commitment_to_use = _COMMITMENT_TO_SOLDERS[commitment or self._commitment]
        accounts = None
        if accounts_addresses is not None:
            accounts_encoding_to_use = _ACCOUNT_ENCODING_TO_SOLDERS[accounts_encoding]
            accounts = RpcSimulateTransactionAccountsConfig(
                addresses=accounts_addresses, encoding=accounts_encoding_to_use
            )
        config = RpcSimulateTransactionConfig(
            sig_verify=sig_verify,
            commitment=commitment_to_use,
            replace_recent_blockhash=replace_recent_blockhash,
            min_context_slot=min_context_slot,
            inner_instructions=inner_instructions,
            accounts=accounts,
        )
        if isinstance(txn, Transaction):
            return SimulateLegacyTransaction(txn, config)
        return SimulateVersionedTransaction(txn, config)

    @staticmethod
    def _post_send(resp: SendTransactionResp) -> SendTransactionResp:
        if isinstance(resp, InvalidParamsMessage):
            raise RPCNoResultException(resp.message)

        if not resp.value:
            raise RPCNoResultException("Failed to send transaction")
        return resp

    @staticmethod
    def parse_recent_blockhash(blockhash_resp: GetLatestBlockhashResp) -> Blockhash:
        """Extract blockhash from JSON RPC result."""
        return blockhash_resp.value.blockhash
