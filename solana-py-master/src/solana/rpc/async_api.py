"""Async API client to interact with the Solana JSON RPC Endpoint."""  # pylint: disable=too-many-lines

import asyncio
from time import time
from typing import Dict, List, Optional, Sequence, Union

from solders.message import VersionedMessage
from solders.pubkey import Pubkey
from solders.rpc.responses import (
    GetAccountInfoMaybeJsonParsedResp,
    GetAccountInfoResp,
    GetBalanceResp,
    GetBlockCommitmentResp,
    GetBlockHeightResp,
    GetBlockResp,
    GetBlocksResp,
    GetBlockTimeResp,
    GetClusterNodesResp,
    GetEpochInfoResp,
    GetEpochScheduleResp,
    GetFeeForMessageResp,
    GetFirstAvailableBlockResp,
    GetGenesisHashResp,
    GetHealthResp,
    GetIdentityResp,
    GetInflationGovernorResp,
    GetInflationRateResp,
    GetInflationRewardResp,
    GetLargestAccountsResp,
    GetLatestBlockhashResp,
    GetLeaderScheduleResp,
    GetMinimumBalanceForRentExemptionResp,
    GetMultipleAccountsMaybeJsonParsedResp,
    GetMultipleAccountsResp,
    GetProgramAccountsMaybeJsonParsedResp,
    GetProgramAccountsResp,
    GetRecentPerformanceSamplesResp,
    GetSignaturesForAddressResp,
    GetSignatureStatusesResp,
    GetSlotLeaderResp,
    GetSlotLeadersResp,
    GetSlotResp,
    GetSupplyResp,
    GetTokenAccountBalanceResp,
    GetTokenAccountsByDelegateJsonParsedResp,
    GetTokenAccountsByDelegateResp,
    GetTokenAccountsByOwnerJsonParsedResp,
    GetTokenAccountsByOwnerResp,
    GetTokenLargestAccountsResp,
    GetTokenSupplyResp,
    GetTransactionCountResp,
    GetTransactionResp,
    GetVersionResp,
    GetVoteAccountsResp,
    MinimumLedgerSlotResp,
    RequestAirdropResp,
    SendTransactionResp,
    SimulateTransactionResp,
    ValidatorExitResp,
)
from solders.signature import Signature
from solders.transaction import Transaction, VersionedTransaction

from solana.rpc import types

from .commitment import Commitment
from .core import (
    _COMMITMENT_TO_SOLDERS,
    TransactionExpiredBlockheightExceededError,
    UnconfirmedTxError,
    _ClientCore,
)
from .providers import async_http


class AsyncClient(_ClientCore):  # pylint: disable=too-many-public-methods
    """Async client class.

    Args:
        endpoint: URL of the RPC endpoint.
        commitment: Default bank state to query. It can be either "finalized", "confirmed" or "processed".
        timeout: HTTP request timeout in seconds.
        extra_headers: Extra headers to pass for HTTP request.
        proxy: Proxy URL to pass to the HTTP client.
    """

    def __init__(
        self,
        endpoint: Optional[str] = None,
        commitment: Optional[Commitment] = None,
        timeout: float = 10,
        extra_headers: Optional[Dict[str, str]] = None,
        proxy: Optional[str] = None,
    ) -> None:
        """Init API client."""
        super().__init__(commitment)
        self._provider = async_http.AsyncHTTPProvider(
            endpoint, timeout=timeout, extra_headers=extra_headers, proxy=proxy
        )

    async def __aenter__(self) -> "AsyncClient":
        """Use as a context manager."""
        await self._provider.__aenter__()
        return self

    async def __aexit__(self, _exc_type, _exc, _tb):
        """Exits the context manager."""
        await self.close()

    async def close(self) -> None:
        """Use this when you are done with the client."""
        await self._provider.close()

    async def is_connected(self) -> bool:
        """Health check.

        >>> solana_client = AsyncClient("http://localhost:8899")
        >>> asyncio.run(solana_client.is_connected()) # doctest: +SKIP
        True

        Returns:
            True if the client is connected.
        """
        body = self._get_health_body()
        response = await self._provider.make_request(body, GetHealthResp)
        return response.value == "ok"

    async def get_balance(self, pubkey: Pubkey, commitment: Optional[Commitment] = None) -> GetBalanceResp:
        """Returns the balance of the account of provided Pubkey.

        Args:
            pubkey: Pubkey of account to query
            commitment: Bank state to query. It can be either "finalized", "confirmed" or "processed".

        Example:
            >>> from solders.pubkey import Pubkey
            >>> solana_client = AsyncClient("http://localhost:8899")
            >>> (await solana_client.get_balance(Pubkey([0] * 31 + [1]))).value # doctest: +SKIP
            0
        """
        body = self._get_balance_body(pubkey, commitment)
        return await self._provider.make_request(body, GetBalanceResp)

    async def get_account_info(
        self,
        pubkey: Pubkey,
        commitment: Optional[Commitment] = None,
        encoding: str = "base64",
        data_slice: Optional[types.DataSliceOpts] = None,
    ) -> GetAccountInfoResp:
        """Returns all the account info for the specified public key.

        Args:
            pubkey: Pubkey of account to query
            commitment: Bank state to query. It can be either "finalized", "confirmed" or "processed".
            encoding: (optional) Encoding for Account data, either "base58" (slow), "base64", or
                "jsonParsed". Default is "base64".

                - "base58" is limited to Account data of less than 128 bytes.
                - "base64" will return base64 encoded data for Account data of any size.
                - "jsonParsed" encoding attempts to use program-specific state parsers to return more human-readable and explicit account state data.

                If jsonParsed is requested but a parser cannot be found, the field falls back to base64 encoding,
                detectable when the data field is type. (jsonParsed encoding is UNSTABLE).
            data_slice: (optional) Option to limit the returned account data using the provided `offset`: <usize> and
                `length`: <usize> fields; only available for "base58" or "base64" encoding.

        Example:
            >>> from solders.pubkey import Pubkey
            >>> solana_client = AsyncClient("http://localhost:8899")
            >>> (await solana_client.get_account_info(Pubkey([0] * 31 + [1]))).value # doctest: +SKIP
            Account(
                Account {
                    lamports: 4104230290,
                    data.len: 0,
                    owner: 11111111111111111111111111111111,
                    executable: false,
                    rent_epoch: 371,
                },
            )
        """  # noqa: E501 # pylint: disable=line-too-long
        body = self._get_account_info_body(
            pubkey=pubkey,
            commitment=commitment,
            encoding=encoding,
            data_slice=data_slice,
        )
        return await self._provider.make_request(body, GetAccountInfoResp)

    async def get_account_info_json_parsed(
        self,
        pubkey: Pubkey,
        commitment: Optional[Commitment] = None,
    ) -> GetAccountInfoMaybeJsonParsedResp:
        """Returns all the account info for the specified public key.

        If JSON formatting is not available for this account, base64 is returned.

        Args:
            pubkey: Pubkey of account to query
            commitment: Bank state to query. It can be either "finalized", "confirmed" or "processed".

        Example:
            >>> from solders.pubkey import Pubkey
            >>> solana_client = AsyncClient("http://localhost:8899")
            >>> (await solana_client.get_account_info_json_parsed(Pubkey([0] * 31 + [1]))).value.owner # doctest: +SKIP
            Pubkey(
                11111111111111111111111111111111,
            )
        """
        body = self._get_account_info_body(pubkey=pubkey, commitment=commitment, encoding="jsonParsed", data_slice=None)
        return await self._provider.make_request(body, GetAccountInfoMaybeJsonParsedResp)

    async def get_block_commitment(self, slot: int) -> GetBlockCommitmentResp:
        """Fetch the commitment for particular block.

        Args:
            slot: Block, identified by Slot.

        Example:
            >>> solana_client = AsyncClient("http://localhost:8899")
            >>> (await solana_client.get_block_commitment(0)).total_stake # doctest: +SKIP
            497717120
        """
        body = self._get_block_commitment_body(slot)
        return await self._provider.make_request(body, GetBlockCommitmentResp)

    async def get_block_time(self, slot: int) -> GetBlockTimeResp:
        """Fetch the estimated production time of a block.

        Args:
            slot: Block, identified by Slot.

        Example:
            >>> solana_client = AsyncClient("http://localhost:8899")
            >>> (await solana_client.get_block_time(5)).value # doctest: +SKIP
            1598400007
        """
        body = self._get_block_time_body(slot)
        return await self._provider.make_request(body, GetBlockTimeResp)

    async def get_cluster_nodes(self) -> GetClusterNodesResp:
        """Returns information about all the nodes participating in the cluster.

        Example:
            >>> solana_client = AsyncClient("http://localhost:8899")
            >>> (await solana_client.get_cluster_nodes()).value[0].tpu # doctest: +SKIP
            '139.178.65.155:8004'
        """
        return await self._provider.make_request(self._get_cluster_nodes, GetClusterNodesResp)

    async def get_block(
        self,
        slot: int,
        encoding: str = "json",
        max_supported_transaction_version: Union[int, None] = None,
    ) -> GetBlockResp:
        """Returns identity and transaction information about a confirmed block in the ledger.

        Args:
            slot: Slot, as u64 integer.
            encoding: (optional) Encoding for the returned Transaction, either "json", "jsonParsed",
                    "base58" (slow), or "base64". If parameter not provided, the default encoding is JSON.
            max_supported_transaction_version: (optional) The max transaction version to return in
                responses. If the requested transaction is a higher version, an error will be returned

        Example:
            >>> solana_client = AsyncClient("http://localhost:8899")
            >>> (await solana_client.get_block(1)).value.blockhash # doctest: +SKIP
            Hash(
                EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG,
            )
        """
        body = self._get_block_body(slot, encoding, max_supported_transaction_version)
        return await self._provider.make_request(body, GetBlockResp)

    async def get_recent_performance_samples(self, limit: Optional[int] = None) -> GetRecentPerformanceSamplesResp:
        """Returns a list of recent performance samples, in reverse slot order.

        Performance samples are taken every 60 seconds and include the number of transactions and slots that occur in a given time window.

        Args:
            limit: Limit (optional) number of samples to return (maximum 720)

        Examples:
            >>> solana_client = AsyncClient("http://localhost:8899")
            >>> (await solana_client.get_recent_performance_samples(1)).value[0] # doctest: +SKIP
            RpcPerfSample(
                RpcPerfSample {
                    slot: 168036172,
                    num_transactions: 7159,
                    num_slots: 158,
                    sample_period_secs: 60,
                },
            )
        """  # noqa: E501 # pylint: disable=line-too-long
        body = self._get_recent_performance_samples_body(limit)
        return await self._provider.make_request(body, GetRecentPerformanceSamplesResp)

    async def get_block_height(self, commitment: Optional[Commitment] = None) -> GetBlockHeightResp:
        """Returns the current block height of the node.

        Args:
            commitment: Bank state to query. It can be either "finalized", "confirmed" or "processed".

        Example:
            >>> solana_client = AsyncClient("http://localhost:8899")
            >>> (await solana_client.get_block_height()).value # doctest: +SKIP
            1233
        """
        body = self._get_block_height_body(commitment)
        return await self._provider.make_request(body, GetBlockHeightResp)

    async def get_blocks(self, start_slot: int, end_slot: Optional[int] = None) -> GetBlocksResp:
        """Returns a list of confirmed blocks.

        Args:
            start_slot: Start slot, as u64 integer.
            end_slot: (optional) End slot, as u64 integer.

        Example:
            >>> solana_client = AsyncClient("http://localhost:8899")
            >>> (await solana_client.get_blocks(5, 10)).value # doctest: +SKIP
            [5, 6, 7, 8, 9, 10]
        """
        body = self._get_blocks_body(start_slot, end_slot)
        return await self._provider.make_request(body, GetBlocksResp)

    async def get_signatures_for_address(
        self,
        account: Pubkey,
        before: Optional[Signature] = None,
        until: Optional[Signature] = None,
        limit: Optional[int] = None,
        commitment: Optional[Commitment] = None,
    ) -> GetSignaturesForAddressResp:
        """Returns confirmed signatures for transactions involving an address.

        Signatures are returned backwards in time from the provided signature or
        most recent confirmed block.

        Args:
            account: Account to be queried.
            before: (optional) Start searching backwards from this transaction signature.
                If not provided the search starts from the top of the highest max confirmed block.
            until: (optional) Search until this transaction signature, if found before limit reached.
            limit: (optional) Maximum transaction signatures to return (between 1 and 1,000, default: 1,000).
            commitment: (optional) Bank state to query. It can be either "finalized", "confirmed" or "processed".

        Example:
            >>> solana_client = AsyncClient("http://localhost:8899")
            >>> from solders.pubkey import Pubkey
            >>> pubkey = Pubkey.from_string("Vote111111111111111111111111111111111111111")
            >>> (await solana_client.get_signatures_for_address(pubkey, limit=1)).value[0].signature # doctest: +SKIP
            Signature(
                1111111111111111111111111111111111111111111111111111111111111111,
            )
        """
        body = self._get_signatures_for_address_body(account, before, until, limit, commitment)
        return await self._provider.make_request(body, GetSignaturesForAddressResp)

    async def get_transaction(
        self,
        tx_sig: Signature,
        encoding: str = "json",
        commitment: Optional[Commitment] = None,
        max_supported_transaction_version: Optional[int] = None,
    ) -> GetTransactionResp:
        """Returns transaction details for a confirmed transaction.

        Args:
            tx_sig: Transaction signature as base-58 encoded string N encoding attempts to use program-specific
                instruction parsers to return more human-readable and explicit data in the
                `transaction.message.instructions` list.
            encoding: (optional) Encoding for the returned Transaction, either "json", "jsonParsed",
                "base58" (slow), or "base64". If parameter not provided, the default encoding is JSON.
            commitment: Bank state to query. It can be either "finalized", "confirmed" or "processed".
            max_supported_transaction_version: (optional) The max transaction version to return in responses.
                If the requested transaction is a higher version, an error will be returned

        Example:
            >>> solana_client = AsyncClient("http://localhost:8899")
            >>> from solders.signature import Signature
            >>> sig = Signature.from_string("3PtGYH77LhhQqTXP4SmDVJ85hmDieWsgXCUbn14v7gYyVYPjZzygUQhTk3bSTYnfA48vCM1rmWY7zWL3j1EVKmEy")
            >>> (await solana_client.get_transaction(sig)).value.block_time # doctest: +SKIP
            1234
        """  # noqa: E501 # pylint: disable=line-too-long
        body = self._get_transaction_body(tx_sig, encoding, commitment, max_supported_transaction_version)
        return await self._provider.make_request(body, GetTransactionResp)

    async def get_epoch_info(self, commitment: Optional[Commitment] = None) -> GetEpochInfoResp:
        """Returns information about the current epoch.

        Args:
            commitment: Bank state to query. It can be either "finalized", "confirmed" or "processed".

        Example:
            >>> solana_client = AsyncClient("http://localhost:8899")
            >>> (await solana_client.get_epoch_info()).value.epoch # doctest: +SKIP
            0
        """
        body = self._get_epoch_info_body(commitment)
        return await self._provider.make_request(body, GetEpochInfoResp)

    async def get_epoch_schedule(self) -> GetEpochScheduleResp:
        """Returns epoch schedule information from this cluster's genesis config.

        Example:
            >>> solana_client = AsyncClient("http://localhost:8899")
            >>> (await solana_client.get_epoch_schedule()).value.slots_per_epoch # doctest: +SKIP
            8192
        """
        return await self._provider.make_request(self._get_epoch_schedule, GetEpochScheduleResp)

    async def get_fee_for_message(
        self, message: VersionedMessage, commitment: Optional[Commitment] = None
    ) -> GetFeeForMessageResp:
        """Returns the fee for a message.

        Args:
            message: Message that the fee is requested for.
            commitment: Bank state to query. It can be either "finalized", "confirmed" or "processed".

        Example:
            >>> from solders.keypair import Keypair
            >>> from solders.system_program import TransferParams, transfer
            >>> from solders.message import Message
            >>> leading_zeros = [0] * 31
            >>> sender, receiver = Keypair.from_seed(leading_zeros + [1]), Keypair.from_seed(leading_zeros + [2])
            >>> msg = Message([transfer(TransferParams(
            ...     from_pubkey=sender.pubkey(), to_pubkey=receiver.pubkey(), lamports=1000))])
            >>> solana_client = AsyncClient("http://localhost:8899")
            >>> (await solana_client.get_fee_for_message(msg)).value # doctest: +SKIP
            5000
        """
        body = self._get_fee_for_message_body(message, commitment)
        return await self._provider.make_request(body, GetFeeForMessageResp)

    async def get_first_available_block(self) -> GetFirstAvailableBlockResp:
        """Returns the slot of the lowest confirmed block that has not been purged from the ledger.

        Example:
            >>> solana_client = AsyncClient("http://localhost:8899")
            >>> (await solana_client.get_first_available_block()).value # doctest: +SKIP
            1
        """
        return await self._provider.make_request(self._get_first_available_block, GetFirstAvailableBlockResp)

    async def get_genesis_hash(self) -> GetGenesisHashResp:
        """Returns the genesis hash.

        Example:
            >>> solana_client = AsyncClient("http://localhost:8899")
            >>> (await solana_client.get_genesis_hash()).value # doctest: +SKIP
            Hash(
                EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG,
            )
        """
        return await self._provider.make_request(self._get_genesis_hash, GetGenesisHashResp)

    async def get_identity(self) -> GetIdentityResp:
        """Returns the identity pubkey for the current node.

        Example:
            >>> solana_client = AsyncClient("http://localhost:8899")
            >>> (await solana_client.get_identity()).value.identity # doctest: +SKIP
            Pubkey(
                2LVtX3Wq5bhqAYYaUYBRknWaYrsfYiXLQBHTxtHWD2mv,
            )
        """
        return await self._provider.make_request(self._get_identity, GetIdentityResp)

    async def get_inflation_governor(self, commitment: Optional[Commitment] = None) -> GetInflationGovernorResp:
        """Returns the current inflation governor.

        Args:
            commitment: Bank state to query. It can be either "finalized", "confirmed" or "processed".

        Example:
            >>> solana_client = AsyncClient("http://localhost:8899")
            >>> await (solana_client.get_inflation_governor()).value.foundation # doctest: +SKIP
            0.05
        """
        body = self._get_inflation_governor_body(commitment)
        return await self._provider.make_request(body, GetInflationGovernorResp)

    async def get_inflation_rate(self) -> GetInflationRateResp:
        """Returns the specific inflation values for the current epoch.

        Example:
            >>> solana_client = AsyncClient("http://localhost:8899")
            >>> (await solana_client.get_inflation_rate()).value.epoch # doctest: +SKIP
            1
        """
        return await self._provider.make_request(self._get_inflation_rate, GetInflationRateResp)

    async def get_inflation_reward(
        self, pubkeys: List[Pubkey], epoch: Optional[int] = None, commitment: Optional[Commitment] = None
    ) -> GetInflationRewardResp:
        """Returns the inflation / staking reward for a list of addresses for an epoch.

        Args:
            pubkeys: An array of addresses to query, as base-58 encoded strings
            epoch: (optional) An epoch for which the reward occurs. If omitted, the previous epoch will be used
            commitment: Bank state to query. It can be either "finalized" or "confirmed".

        Example:
            >>> solana_client = AsyncClient("http://localhost:8899")
            >>> (await solana_client.get_inflation_reward()).value.amount # doctest: +SKIP
            2500
        """
        body = self._get_inflation_reward_body(pubkeys, epoch, commitment)
        return await self._provider.make_request(body, GetInflationRewardResp)

    async def get_largest_accounts(
        self, filter_opt: Optional[str] = None, commitment: Optional[Commitment] = None
    ) -> GetLargestAccountsResp:
        """Returns the 20 largest accounts, by lamport balance.

        Args:
            filter_opt: Filter results by account type; currently supported: circulating|nonCirculating.
            commitment: Bank state to query. It can be either "finalized", "confirmed" or "processed".

        Example:
            >>> solana_client = AsyncClient("http://localhost:8899")
            >>> (await solana_client.get_largest_accounts()).value[0].lamports # doctest: +SKIP
            500000000000000000
        """
        body = self._get_largest_accounts_body(filter_opt, commitment)
        return await self._provider.make_request(body, GetLargestAccountsResp)

    async def get_leader_schedule(
        self, epoch: Optional[int] = None, commitment: Optional[Commitment] = None
    ) -> GetLeaderScheduleResp:
        """Returns the leader schedule for an epoch.

        Args:
            epoch: Fetch the leader schedule for the epoch that corresponds to the provided slot.
                If unspecified, the leader schedule for the current epoch is fetched.
            commitment: Bank state to query. It can be either "finalized", "confirmed" or "processed".

        Example:
            >>> solana_client = AsyncClient("http://localhost:8899")
            >>> resp = await solana_client.get_leader_schedule() # doctest: +SKIP
            >>> list(resp.value.items())[0] # doctest: +SKIP
            (Pubkey(
                HMU77m6WSL9Xew9YvVCgz1hLuhzamz74eD9avi4XPdr,
            ), [346448, 346449, 346450, 346451, 369140, 369141, 369142, 369143, 384204, 384205, 384206, 384207])
        """
        body = self._get_leader_schedule_body(epoch, commitment)
        return await self._provider.make_request(body, GetLeaderScheduleResp)

    async def get_minimum_balance_for_rent_exemption(
        self, usize: int, commitment: Optional[Commitment] = None
    ) -> GetMinimumBalanceForRentExemptionResp:
        """Returns minimum balance required to make account rent exempt.

        Args:
            usize: Account data length.
            commitment: Bank state to query. It can be either "finalized", "confirmed" or "processed".

        Example:
            >>> solana_client = AsyncClient("http://localhost:8899")
            >>> (await solana_client.get_minimum_balance_for_rent_exemption(50)).value # doctest: +SKIP
            1238880
        """
        body = self._get_minimum_balance_for_rent_exemption_body(usize, commitment)
        return await self._provider.make_request(body, GetMinimumBalanceForRentExemptionResp)

    async def get_multiple_accounts(
        self,
        pubkeys: List[Pubkey],
        commitment: Optional[Commitment] = None,
        encoding: str = "base64",
        data_slice: Optional[types.DataSliceOpts] = None,
    ) -> GetMultipleAccountsResp:
        """Returns all the account info for a list of public keys.

        Args:
            pubkeys: list of Pubkeys to query
            commitment: Bank state to query. It can be either "finalized", "confirmed" or "processed".
            encoding: (optional) Encoding for Account data, either "base58" (slow) or "base64".

                - "base58" is limited to Account data of less than 128 bytes.
                - "base64" will return base64 encoded data for Account data of any size.

            data_slice: (optional) Option to limit the returned account data using the provided `offset`: <usize> and
                `length`: <usize> fields; only available for "base58" or "base64" encoding.

        Example:
            >>> from solders.pubkey import Pubkey
            >>> solana_client = AsyncClient("http://localhost:8899")
            >>> pubkeys = [Pubkey.from_string("6ZWcsUiWJ63awprYmbZgBQSreqYZ4s6opowP4b7boUdh"), Pubkey.from_string("HkcE9sqQAnjJtECiFsqGMNmUho3ptXkapUPAqgZQbBSY")]
            >>> (await solana_client.get_multiple_accounts(pubkeys)).value[0].lamports # doctest: +SKIP
            1
        """  # noqa: E501 # pylint: disable=line-too-long
        body = self._get_multiple_accounts_body(
            pubkeys=pubkeys,
            commitment=commitment,
            encoding=encoding,
            data_slice=data_slice,
        )
        return await self._provider.make_request(body, GetMultipleAccountsResp)

    async def get_multiple_accounts_json_parsed(
        self,
        pubkeys: List[Pubkey],
        commitment: Optional[Commitment] = None,
    ) -> GetMultipleAccountsMaybeJsonParsedResp:
        """Returns all the account info for a list of public keys.

        Args:
            pubkeys: list of Pubkeys to query
            commitment: Bank state to query. It can be either "finalized", "confirmed" or "processed".

        Example:
            >>> from solders.pubkey import Pubkey
            >>> solana_client = AsyncClient("http://localhost:8899")
            >>> pubkeys = [Pubkey.from_string("6ZWcsUiWJ63awprYmbZgBQSreqYZ4s6opowP4b7boUdh"), Pubkey.from_string("HkcE9sqQAnjJtECiFsqGMNmUho3ptXkapUPAqgZQbBSY")]
            >>> asyncio.run(solana_client.get_multiple_accounts(pubkeys)).value[0].lamports # doctest: +SKIP
            1
        """  # noqa: E501 # pylint: disable=line-too-long
        body = self._get_multiple_accounts_body(
            pubkeys=pubkeys,
            commitment=commitment,
            encoding="jsonParsed",
            data_slice=None,
        )
        return await self._provider.make_request(body, GetMultipleAccountsMaybeJsonParsedResp)

    async def get_program_accounts(  # pylint: disable=too-many-arguments
        self,
        pubkey: Pubkey,
        commitment: Optional[Commitment] = None,
        encoding: Optional[str] = None,
        data_slice: Optional[types.DataSliceOpts] = None,
        filters: Optional[Sequence[Union[int, types.MemcmpOpts]]] = None,
    ) -> GetProgramAccountsResp:
        """Returns all accounts owned by the provided program Pubkey.

        Args:
            pubkey: Pubkey of program
            commitment: Bank state to query. It can be either "finalized", "confirmed" or "processed".
            encoding: (optional) Encoding for the returned Transaction, either jsonParsed",
                "base58" (slow), or "base64".
            data_slice: (optional) Limit the returned account data using the provided `offset`: <usize> and
                `length`: <usize> fields; only available for "base58" or "base64" encoding.
            filters: (optional) Options to compare a provided series of bytes with program account data at a particular offset.
                Note: an int entry is converted to a `dataSize` filter.

        Example:
            >>> from typing import List, Union
            >>> solana_client = AsyncClient("http://localhost:8899")
            >>> memcmp_opts = types.MemcmpOpts(offset=4, bytes="3Mc6vR")
            >>> pubkey = Pubkey.from_string("4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T")
            >>> filters: List[Union[int, types.MemcmpOpts]] = [17, memcmp_opts]
            >>> (await solana_client.get_program_accounts(pubkey, filters=filters)).value[0].account.lamports # doctest: +SKIP
            1
        """  # noqa: E501 # pylint: disable=line-too-long
        body = self._get_program_accounts_body(
            pubkey=pubkey,
            commitment=commitment,
            encoding=encoding,
            data_slice=data_slice,
            filters=filters,
        )
        return await self._provider.make_request(body, GetProgramAccountsResp)

    async def get_program_accounts_json_parsed(  # pylint: disable=too-many-arguments
        self,
        pubkey: Pubkey,
        commitment: Optional[Commitment] = None,
        filters: Optional[Sequence[Union[int, types.MemcmpOpts]]] = None,
    ) -> GetProgramAccountsMaybeJsonParsedResp:
        """Returns all accounts owned by the provided program Pubkey.

        Args:
            pubkey: Pubkey of program
            commitment: Bank state to query. It can be either "finalized", "confirmed" or "processed".
            filters: (optional) Options to compare a provided series of bytes with program account data at a particular offset.
                Note: an int entry is converted to a `dataSize` filter.

        Example:
            >>> from typing import List, Union
            >>> solana_client = AsyncClient("http://localhost:8899")
            >>> memcmp_opts = types.MemcmpOpts(offset=4, bytes="3Mc6vR")
            >>> pubkey = Pubkey.from_string("4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T")
            >>> filters: List[Union[int, types.MemcmpOpts]] = [17, memcmp_opts]
            >>> (await solana_client.get_program_accounts(pubkey, filters=filters)).value[0].account.lamports # doctest: +SKIP
            1
        """  # noqa: E501 # pylint: disable=line-too-long
        body = self._get_program_accounts_body(
            pubkey=pubkey,
            commitment=commitment,
            encoding="jsonParsed",
            data_slice=None,
            filters=filters,
        )
        return await self._provider.make_request(body, GetProgramAccountsMaybeJsonParsedResp)

    async def get_latest_blockhash(self, commitment: Optional[Commitment] = None) -> GetLatestBlockhashResp:
        """Returns the latest block hash from the ledger.

        Response also includes the last valid block height.

        Args:
            commitment: Bank state to query. It can be either "finalized", "confirmed" or "processed".

        Example:
            >>> solana_client = AsyncClient("http://localhost:8899")
            >>> (await solana_client.get_latest_blockhash()).value # doctest: +SKIP
            RpcBlockhash {
                blockhash: Hash(
                    4TLzN2RAACFnd5TYpHcUi76pC3V1qkggRF29HWk2VLeT,
                ),
                last_valid_block_height: 158286487,
            }
        """
        body = self._get_latest_blockhash_body(commitment)
        return await self._provider.make_request(body, GetLatestBlockhashResp)

    async def get_signature_statuses(
        self, signatures: List[Signature], search_transaction_history: bool = False
    ) -> GetSignatureStatusesResp:
        """Returns the statuses of a list of signatures.

        Unless the `search_transaction_history` configuration parameter is included, this method only
        searches the recent status cache of signatures, which retains statuses for all active slots plus
        `MAX_RECENT_BLOCKHASHES` rooted slots.

        Args:
            signatures: An array of transaction signatures to confirm.
            search_transaction_history: If true, a Solana node will search its ledger cache for
                any signatures not found in the recent status cache.

        Example:
            >>> solana_client = AsyncClient("http://localhost:8899")
            >>> raw_sigs = [
            ...     "5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW",
            ...     "5j7s6NiJS3JAkvgkoc18WVAsiSaci2pxB2A6ueCJP4tprA2TFg9wSyTLeYouxPBJEMzJinENTkpA52YStRW5Dia7"]
            >>> sigs = [Signature.from_string(sig) for sig in raw_sigs]
            >>> (await solana_client.get_signature_statuses(sigs)).value[0].confirmations # doctest: +SKIP
            10
        """
        body = self._get_signature_statuses_body(signatures, search_transaction_history)
        return await self._provider.make_request(body, GetSignatureStatusesResp)

    async def get_slot(self, commitment: Optional[Commitment] = None) -> GetSlotResp:
        """Returns the current slot the node is processing.

        Args:
            commitment: Bank state to query. It can be either "finalized", "confirmed" or "processed".

        Example:
            >>> solana_client = AsyncClient("http://localhost:8899")
            >>> (await solana_client.get_slot()).value # doctest: +SKIP
            7515
        """
        body = self._get_slot_body(commitment)
        return await self._provider.make_request(body, GetSlotResp)

    async def get_slot_leader(self, commitment: Optional[Commitment] = None) -> GetSlotLeaderResp:
        """Returns the current slot leader.

        Args:
            commitment: Bank state to query. It can be either "finalized", "confirmed" or "processed".

        Example:
            >>> solana_client = AsyncClient("http://localhost:8899")
            >>> (await solana_client.get_slot_leader()).value # doctest: +SKIP
            Pubkey(
                dv2eQHeP4RFrJZ6UeiZWoc3XTtmtZCUKxxCApCDcRNV,
            )
        """
        body = self._get_slot_leader_body(commitment)
        return await self._provider.make_request(body, GetSlotLeaderResp)

    async def get_slot_leaders(self, start: int, limit: int) -> GetSlotLeadersResp:
        """Returns the list of slot leaders for the provided start slot and limit.

        Args:
            start: The start slot to get the slot leaders from.
            limit: The number of slot leaders to return.

        Returns:
            A list of slot leaders.
        """
        body = self._get_slot_leaders_body(start, limit)
        return await self._provider.make_request(body, GetSlotLeadersResp)

    async def get_supply(self, commitment: Optional[Commitment] = None) -> GetSupplyResp:
        """Returns information about the current supply.

        Args:
            commitment: Bank state to query. It can be either "finalized", "confirmed" or "processed".

        Example:
            >>> solana_client = AsyncClient("http://localhost:8899")
            >>> (await solana_client.get_supply()).value.circulating # doctest: +SKIP
            683635192454157660
        """
        body = self._get_supply_body(commitment)
        return await self._provider.make_request(body, GetSupplyResp)

    async def get_token_account_balance(
        self, pubkey: Pubkey, commitment: Optional[Commitment] = None
    ) -> GetTokenAccountBalanceResp:
        """Returns the token balance of an SPL Token account (UNSTABLE).

        Args:
            pubkey: Pubkey of Token account to query
            commitment: Bank state to query. It can be either "finalized", "confirmed" or "processed".

        Example:
            >>> solana_client = AsyncClient("http://localhost:8899")
            >>> pubkey = Pubkey.from_string("7fUAJdStEuGbc3sM84cKRL6yYaaSstyLSU4ve5oovLS7")
            >>> (await solana_client.get_token_account_balance(pubkey)).value.amount  # noqa: E501 # doctest: +SKIP
            '9864'
        """
        body = self._get_token_account_balance_body(pubkey, commitment)
        return await self._provider.make_request(body, GetTokenAccountBalanceResp)

    async def get_token_accounts_by_delegate(
        self,
        delegate: Pubkey,
        opts: types.TokenAccountOpts,
        commitment: Optional[Commitment] = None,
    ) -> GetTokenAccountsByDelegateResp:
        """Returns all SPL Token accounts by approved Delegate (UNSTABLE).

        Args:
            delegate: Public key of the delegate owner to query.
            opts: Token account option specifying at least one of `mint` or `program_id`.
            commitment: Bank state to query. It can be either "finalized", "confirmed" or "processed".
        """
        body = self._get_token_accounts_by_delegate_body(delegate, opts, commitment)
        return await self._provider.make_request(body, GetTokenAccountsByDelegateResp)

    async def get_token_accounts_by_delegate_json_parsed(
        self,
        delegate: Pubkey,
        opts: types.TokenAccountOpts,
        commitment: Optional[Commitment] = None,
    ) -> GetTokenAccountsByDelegateJsonParsedResp:
        """Returns all SPL Token accounts by approved delegate in JSON format (UNSTABLE).

        Args:
            delegate: Public key of the delegate owner to query.
            opts: Token account option specifying at least one of `mint` or `program_id`.
            commitment: Bank state to query. It can be either "finalized", "confirmed" or "processed".
        """
        body = self._get_token_accounts_by_delegate_json_parsed_body(delegate, opts, commitment)
        return await self._provider.make_request(body, GetTokenAccountsByDelegateJsonParsedResp)

    async def get_token_accounts_by_owner_json_parsed(
        self,
        owner: Pubkey,
        opts: types.TokenAccountOpts,
        commitment: Optional[Commitment] = None,
    ) -> GetTokenAccountsByOwnerJsonParsedResp:
        """Returns all SPL Token accounts by token owner in JSON format (UNSTABLE).

        Args:
            owner: Public key of the account owner to query.
            opts: Token account option specifying at least one of `mint` or `program_id`.
            commitment: Bank state to query. It can be either "finalized", "confirmed" or "processed".
        """
        body = self._get_token_accounts_by_owner_json_parsed_body(owner, opts, commitment)
        return await self._provider.make_request(body, GetTokenAccountsByOwnerJsonParsedResp)

    async def get_token_accounts_by_owner(
        self,
        owner: Pubkey,
        opts: types.TokenAccountOpts,
        commitment: Optional[Commitment] = None,
    ) -> GetTokenAccountsByOwnerResp:
        """Returns all SPL Token accounts by token owner (UNSTABLE).

        Args:
            owner: Public key of the account owner to query.
            opts: Token account option specifying at least one of `mint` or `program_id`.
            commitment: Bank state to query. It can be either "finalized", "confirmed" or "processed".
        """
        body = self._get_token_accounts_by_owner_body(owner, opts, commitment)
        return await self._provider.make_request(body, GetTokenAccountsByOwnerResp)

    async def get_token_largest_accounts(
        self, pubkey: Pubkey, commitment: Optional[Commitment] = None
    ) -> GetTokenLargestAccountsResp:
        """Returns the 20 largest accounts of a particular SPL Token type."""
        body = self._get_token_largest_accounts_body(pubkey, commitment)
        return await self._provider.make_request(body, GetTokenLargestAccountsResp)

    async def get_token_supply(self, pubkey: Pubkey, commitment: Optional[Commitment] = None) -> GetTokenSupplyResp:
        """Returns the total supply of an SPL Token type."""
        body = self._get_token_supply_body(pubkey, commitment)
        return await self._provider.make_request(body, GetTokenSupplyResp)

    async def get_transaction_count(self, commitment: Optional[Commitment] = None) -> GetTransactionCountResp:
        """Returns the current Transaction count from the ledger.

        Args:
            commitment: Bank state to query. It can be either "finalized", "confirmed" or "processed".

        Example:
            >>> solana_client = AsyncClient("http://localhost:8899")
            >>> (await solana_client.get_transaction_count()).value # doctest: +SKIP
            4554
        """
        body = self._get_transaction_count_body(commitment)
        return await self._provider.make_request(body, GetTransactionCountResp)

    async def get_minimum_ledger_slot(self) -> MinimumLedgerSlotResp:
        """Returns the lowest slot that the node has information about in its ledger.

        This value may increase over time if the node is configured to purge older ledger data.

        Example:
            >>> solana_client = AsyncClient("http://localhost:8899")
            >>> (await solana_client.get_minimum_ledger_slot()).value # doctest: +SKIP
            1234
        """
        return await self._provider.make_request(self._minimum_ledger_slot, MinimumLedgerSlotResp)

    async def get_version(self) -> GetVersionResp:
        """Returns the current solana versions running on the node.

        Example:
            >>> solana_client = AsyncClient("http://localhost:8899")
            >>> (await solana_client.get_version()).value.solana_core # doctest: +SKIP
            '1.13.2'
        """
        return await self._provider.make_request(self._get_version, GetVersionResp)

    async def get_vote_accounts(
        self,
        vote_pubkey: Optional[Pubkey] = None,
        commitment: Optional[Commitment] = None,
        keep_unstaked_delinquents: Optional[bool] = None,
        delinquent_slot_distance: Optional[int] = None,
    ) -> GetVoteAccountsResp:
        """Returns the account info and associated stake for all the voting accounts in the current bank.

        Args:
            vote_pubkey: Only return results for this validator vote address.
            commitment: Bank state to query. It can be either "finalized", "confirmed" or "processed".
            keep_unstaked_delinquents: Filter out delinquent validators with no stake.
            delinquent_slot_distance: Specify the number of slots behind the tip that the validator must fall
                to be considered delinquent.

        Example:
            >>> solana_client = AsyncClient("http://localhost:8899")
            >>> (await solana_client.get_vote_accounts()).value.current[0].commission # doctest: +SKIP
            100
        """
        body = self._get_vote_accounts_body(
            vote_pubkey, commitment, keep_unstaked_delinquents, delinquent_slot_distance
        )
        return await self._provider.make_request(body, GetVoteAccountsResp)

    async def request_airdrop(
        self, pubkey: Pubkey, lamports: int, commitment: Optional[Commitment] = None
    ) -> RequestAirdropResp:
        """Requests an airdrop of lamports to a Pubkey.

        Args:
            pubkey: Pubkey of account to receive lamports, as base-58 encoded string or public key object.
            lamports: Amount of lamports.
            commitment: Bank state to query. It can be either "finalized", "confirmed" or "processed".

        Example:
            >>> from solders.pubkey import Pubkey
            >>> solana_client = AsyncClient("http://localhost:8899")
            >>> (await solana_client.request_airdrop(Pubkey([0] * 31 + [1]), 10000)).value # doctest: +SKIP
            Signature(
                1111111111111111111111111111111111111111111111111111111111111111,
            )
        """
        body = self._request_airdrop_body(pubkey, lamports, commitment)
        return await self._provider.make_request(body, RequestAirdropResp)

    async def send_raw_transaction(self, txn: bytes, opts: Optional[types.TxOpts] = None) -> SendTransactionResp:
        """Send a transaction that has already been signed and serialized into the wire format.

        Args:
            txn: Transaction bytes.
            opts: (optional) Transaction options.

        Before submitting, the following preflight checks are performed (unless disabled with the `skip_preflight` option):

            - The transaction signatures are verified.

            - The transaction is simulated against the latest max confirmed bank and on failure an error
                will be returned. Preflight checks may be disabled if desired.


        Example:
            >>> solana_client = AsyncClient("http://localhost:8899")
            >>> full_signed_tx_hex = (
            ...     '01b3795ccfaac3eee838bb05c3b8284122c18acedcd645c914fe8e178c3b62640d8616d061cc818b26cab8ecf3855ecc'
            ...     '72fa113f731ecbd0215e88edc0309d6f0a010001031398f62c6d1a457c51ba6a4b5f3dbd2f69fca93216218dc8997e41'
            ...     '6bd17d93ca68ab4677ffb1f2894dd0a6153c231d45ec436ae53ae60149dbe15f32e4b8703f0000000000000000000000'
            ...     '000000000000000000000000000000000000000000839618f701ba7e9ba27ae59825dd6d6bb66d14f6d5d0eae215161d7'
            ...     '1851a106901020200010c0200000040420f0000000000'
            ... )
            >>> (await solana_client.send_raw_transaction(bytes.fromhex(full_signed_tx_hex))).value  # doctest: +SKIP
            Signature(
                1111111111111111111111111111111111111111111111111111111111111111,
            )
        """  # noqa: E501 # pylint: disable=line-too-long
        opts_to_use = types.TxOpts(preflight_commitment=self._commitment) if opts is None else opts
        body = self._send_raw_transaction_body(txn, opts_to_use)

        resp = await self._provider.make_request(body, SendTransactionResp)
        if opts_to_use.skip_confirmation:
            return self._post_send(resp)
        post_send_args = self._send_raw_transaction_post_send_args(resp, opts_to_use)
        return await self.__post_send_with_confirm(*post_send_args)

    async def send_transaction(
        self,
        txn: Union[VersionedTransaction, Transaction],
        opts: Optional[types.TxOpts] = None,
    ) -> SendTransactionResp:
        """Send a transaction.

        Args:
            txn: transaction object.
            opts: (optional) Transaction options.

        Example:
            >>> from solders.keypair import Keypair
            >>> from solders.system_program import TransferParams, transfer
            >>> from solders.message import Message
            >>> from solders.transaction import Transaction
            >>> leading_zeros = [0] * 31
            >>> sender, receiver = Keypair.from_seed(leading_zeros + [1]), Keypair.from_seed(leading_zeros + [2])
            >>> ixns = [transfer(TransferParams(
            ...     from_pubkey=sender.pubkey(), to_pubkey=receiver.pubkey(), lamports=1000))]
            >>> msg = Message(ixns, sender.pubkey())
            >>> client = AsyncClient("http://localhost:8899")
            >>> (await client.send_transaction(Transaction([sender], msg, (await client.get_latest_blockhash()).value.blockhash))) # doctest: +SKIP
        """  # noqa: E501
        return await self.send_raw_transaction(bytes(txn), opts=opts)

    async def simulate_transaction(
        self,
        txn: Union[Transaction, VersionedTransaction],
        sig_verify: bool = False,
        commitment: Optional[Commitment] = None,
        replace_recent_blockhash: bool = False,
        min_context_slot: Optional[int] = None,
        inner_instructions: bool = False,
        accounts_addresses: Optional[List[Pubkey]] = None,
        accounts_encoding: str = "base64",
    ) -> SimulateTransactionResp:
        """Simulate sending a transaction.

        Args:
            txn: A transaction object.
            sig_verify: If True the transaction signatures will be verified
                (conflicts with ``replace_recent_blockhash``).
            commitment: Bank state to query. It can be either "finalized", "confirmed" or "processed".
            replace_recent_blockhash: If True the transaction recent blockhash
                will be replaced with the most recent blockhash
                (conflicts with ``sig_verify``).
            min_context_slot: The minimum slot that the request can be evaluated at.
            inner_instructions: If true the response will include inner instructions.
                These inner instructions will be `jsonParsed` where possible, otherwise json.
            accounts_addresses: An array of accounts to return, as base-58 encoded strings
            accounts_encoding: Encoding for returned Account data.
                Note: jsonParsed encoding attempts to use program-specific state parsers to return more
                human-readable and explicit account state data. If jsonParsed is requested but a parser
                cannot be found, the field falls back to base64 encoding, detectable when the returned
                accounts field is type string.

        Example:
            >>> solana_client = AsyncClient("http://localhost:8899")
            >>> full_signed_tx_hex = (
            ...     '01b3795ccfaac3eee838bb05c3b8284122c18acedcd645c914fe8e178c3b62640d8616d061cc818b26cab8ecf3855ecc'
            ...     '72fa113f731ecbd0215e88edc0309d6f0a010001031398f62c6d1a457c51ba6a4b5f3dbd2f69fca93216218dc8997e41'
            ...     '6bd17d93ca68ab4677ffb1f2894dd0a6153c231d45ec436ae53ae60149dbe15f32e4b8703f0000000000000000000000'
            ...     '000000000000000000000000000000000000000000839618f701ba7e9ba27ae59825dd6d6bb66d14f6d5d0eae215161d7'
            ...     '1851a106901020200010c0200000040420f0000000000'
            ... )
            >>> tx = Transaction.from_bytes(bytes.fromhex(full_signed_tx_hex))
            >>> (await solana_client.simulate_transaction(tx)).value.logs  # doctest: +SKIP
            ['BPF program 83astBRguLMdt2h5U1Tpdq5tjFoJ6noeGwaY3mDLVcri success']
        """
        body = self._simulate_transaction_body(
            txn,
            sig_verify,
            commitment,
            replace_recent_blockhash,
            min_context_slot,
            inner_instructions,
            accounts_addresses,
            accounts_encoding,
        )
        return await self._provider.make_request(body, SimulateTransactionResp)

    async def validator_exit(self) -> ValidatorExitResp:
        """Request to have the validator exit.

        Validator must have booted with RPC exit enabled (`--enable-rpc-exit` parameter).

        Example:
            >>> solana_client = AsyncClient("http://localhost:8899")
            >>> (await solana_client.validator_exit()).value # doctest: +SKIP
            True
        """
        return await self._provider.make_request(self._validator_exit, ValidatorExitResp)  # type: ignore

    async def __post_send_with_confirm(
        self,
        resp: SendTransactionResp,
        conf_comm: Commitment,
        last_valid_block_height: Optional[int],
    ) -> SendTransactionResp:
        resp = self._post_send(resp)
        sig = resp.value
        self._provider.logger.info("Transaction sent to %s. Signature %s: ", self._provider.endpoint_uri, sig)
        await self.confirm_transaction(sig, conf_comm, last_valid_block_height=last_valid_block_height)
        return resp

    async def confirm_transaction(
        self,
        tx_sig: Signature,
        commitment: Optional[Commitment] = None,
        sleep_seconds: float = 0.5,
        last_valid_block_height: Optional[int] = None,
    ) -> GetSignatureStatusesResp:
        """Confirm the transaction identified by the specified signature.

        Args:
            tx_sig: the transaction signature to confirm.
            commitment: Bank state to query. It can be either "finalized", "confirmed" or "processed".
            sleep_seconds: The number of seconds to sleep when polling the signature status.
            last_valid_block_height: The block height by which the transaction would become invalid.
        """
        commitment_to_use = _COMMITMENT_TO_SOLDERS[commitment or self._commitment]
        commitment_rank = int(commitment_to_use)
        if last_valid_block_height:  # pylint: disable=no-else-return
            current_blockheight = (await self.get_block_height(commitment)).value
            while current_blockheight <= last_valid_block_height:
                resp = await self.get_signature_statuses([tx_sig])
                resp_value = resp.value[0]
                if resp_value is not None:
                    confirmation_status = resp_value.confirmation_status
                    if confirmation_status is not None:
                        confirmation_rank = int(confirmation_status)
                        if confirmation_rank >= commitment_rank:
                            break
                current_blockheight = (await self.get_block_height(commitment)).value
                await asyncio.sleep(sleep_seconds)
            else:
                raise TransactionExpiredBlockheightExceededError(f"{tx_sig} has expired: block height exceeded")
            return resp
        else:
            timeout = time() + 90
            while time() < timeout:
                resp = await self.get_signature_statuses([tx_sig])
                resp_value = resp.value[0]
                if resp_value is not None:
                    confirmation_status = resp_value.confirmation_status
                    if confirmation_status is not None:
                        confirmation_rank = int(confirmation_status)
                        if confirmation_rank >= commitment_rank:
                            break
                await asyncio.sleep(sleep_seconds)
            else:
                raise UnconfirmedTxError(f"Unable to confirm transaction {tx_sig}")
            return resp
