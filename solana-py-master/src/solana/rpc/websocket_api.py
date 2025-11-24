"""This module contains code for interacting with the RPC Websocket endpoint."""

import itertools
from typing import Any, Dict, List, Optional, Sequence, Union, cast

from solders.account_decoder import UiDataSliceConfig
from solders.pubkey import Pubkey
from solders.rpc.config import (
    RpcAccountInfoConfig,
    RpcBlockSubscribeConfig,
    RpcBlockSubscribeFilter,
    RpcBlockSubscribeFilterMentions,
    RpcProgramAccountsConfig,
    RpcSignatureSubscribeConfig,
    RpcTransactionLogsConfig,
    RpcTransactionLogsFilter,
    RpcTransactionLogsFilterMentions,
)
from solders.rpc.filter import Memcmp
from solders.rpc.requests import (
    AccountSubscribe,
    AccountUnsubscribe,
    BlockSubscribe,
    BlockUnsubscribe,
    Body,
    LogsSubscribe,
    LogsUnsubscribe,
    ProgramSubscribe,
    ProgramUnsubscribe,
    RootSubscribe,
    RootUnsubscribe,
    SignatureSubscribe,
    SignatureUnsubscribe,
    SlotSubscribe,
    SlotsUpdatesSubscribe,
    SlotsUpdatesUnsubscribe,
    SlotUnsubscribe,
    VoteSubscribe,
    VoteUnsubscribe,
    batch_to_json,
)
from solders.rpc.responses import Notification
from solders.rpc.responses import SubscriptionError as SoldersSubscriptionError
from solders.rpc.responses import SubscriptionResult, parse_websocket_message
from solders.signature import Signature
from solders.transaction_status import TransactionDetails
from websockets.legacy.client import WebSocketClientProtocol
from websockets.legacy.client import connect as ws_connect

from solana.rpc import types
from solana.rpc.commitment import Commitment
from solana.rpc.core import _ACCOUNT_ENCODING_TO_SOLDERS, _COMMITMENT_TO_SOLDERS, _TX_ENCODING_TO_SOLDERS


class SubscriptionError(Exception):
    """Raise when subscribing to an RPC feed fails."""

    def __init__(self, err: SoldersSubscriptionError, subscription: Body) -> None:
        """Init.

        Args:
            err: The RPC error object.
            subscription: The subscription message that caused the error.

        """
        self.type = err.error.__class__
        self.msg: str = err.error.message  # type: ignore #  TODO: narrow this union type
        self.subscription = subscription
        super().__init__(f"{self.type.__name__}: {self.msg}\n Caused by subscription: {subscription}")


class SolanaWsClientProtocol(WebSocketClientProtocol):
    """Subclass of `websockets.WebSocketClientProtocol` tailored for Solana RPC websockets."""

    def __init__(self, *args, **kwargs):
        """Init. Args and kwargs are passed to `websockets.WebSocketClientProtocol`."""
        super().__init__(*args, **kwargs)
        self.subscriptions: Dict[int, Body] = {}
        self.sent_subscriptions: Dict[int, Body] = {}
        self.failed_subscriptions = {}
        self.request_counter = itertools.count()

    def increment_counter_and_get_id(self) -> int:
        """Increment self.request_counter and return the latest id."""
        return next(self.request_counter) + 1

    async def send_data(self, message: Union[Body, List[Body]]) -> None:
        """Send a subscribe/unsubscribe request or list of requests.

        Basically `.send` from `websockets` with extra parsing.

        Args:
            message: The request(s) to send.
        """
        if isinstance(message, list):
            to_send = batch_to_json(message)
            for req in message:
                self.sent_subscriptions[req.id] = req
        else:
            to_send = message.to_json()
            self.sent_subscriptions[message.id] = message
        await super().send(to_send)  # type: ignore

    async def recv(  # type: ignore
        self,
    ) -> List[Union[Notification, SubscriptionResult]]:
        """Receive the next message.

        Basically `.recv` from `websockets` with extra parsing.
        """
        data = await super().recv()
        return self._process_rpc_response(cast(str, data))

    async def account_subscribe(
        self,
        pubkey: Pubkey,
        commitment: Optional[Commitment] = None,
        encoding: Optional[str] = None,
    ) -> None:
        """Subscribe to an account to receive notifications when the lamports or data change.

        Args:
            pubkey: Account pubkey.
            commitment: Commitment level.
            encoding: Encoding to use.
        """
        req_id = self.increment_counter_and_get_id()
        commitment_to_use = None if commitment is None else _COMMITMENT_TO_SOLDERS[commitment]
        encoding_to_use = None if encoding is None else _ACCOUNT_ENCODING_TO_SOLDERS[encoding]
        config = (
            None
            if commitment_to_use is None and encoding_to_use is None
            else RpcAccountInfoConfig(encoding=encoding_to_use, commitment=commitment_to_use)
        )
        req = AccountSubscribe(pubkey, config, req_id)
        await self.send_data(req)

    async def account_unsubscribe(
        self,
        subscription: int,
    ) -> None:
        """Unsubscribe from account notifications.

        Args:
            subscription: ID of subscription to cancel.
        """
        req_id = self.increment_counter_and_get_id()
        req = AccountUnsubscribe(subscription, req_id)
        await self.send_data(req)
        del self.subscriptions[subscription]

    async def logs_subscribe(
        self,
        filter_: Union[RpcTransactionLogsFilter, RpcTransactionLogsFilterMentions] = RpcTransactionLogsFilter.All,
        commitment: Optional[Commitment] = None,
    ) -> None:
        """Subscribe to transaction logging.

        Args:
            filter_: filter criteria for the logs.
            commitment: The commitment level to use.
        """
        req_id = self.increment_counter_and_get_id()
        commitment_to_use = None if commitment is None else _COMMITMENT_TO_SOLDERS[commitment]
        config = RpcTransactionLogsConfig(commitment_to_use)
        req = LogsSubscribe(filter_, config, req_id)
        await self.send_data(req)

    async def logs_unsubscribe(
        self,
        subscription: int,
    ) -> None:
        """Unsubscribe from transaction logging.

        Args:
            subscription: ID of subscription to cancel.
        """
        req_id = self.increment_counter_and_get_id()
        req = LogsUnsubscribe(subscription, req_id)
        await self.send_data(req)
        del self.subscriptions[subscription]

    async def block_subscribe(
        self,
        filter_: Union[RpcBlockSubscribeFilter, RpcBlockSubscribeFilterMentions] = RpcBlockSubscribeFilter.All,
        commitment: Optional[Commitment] = None,
        encoding: Optional[str] = None,
        transaction_details: Union[TransactionDetails, None] = None,
        show_rewards: Optional[bool] = None,
        max_supported_transaction_version: Optional[int] = None,
    ) -> None:
        """Subscribe to blocks.

        Args:
            filter_: filter criteria for the blocks.
            commitment: The commitment level to use.
            encoding: Encoding to use.
            transaction_details: level of transaction detail to return.
            show_rewards: whether to populate the rewards array.
            max_supported_transaction_version: the max transaction version to return in responses.
        """
        req_id = self.increment_counter_and_get_id()
        commitment_to_use = None if commitment is None else _COMMITMENT_TO_SOLDERS[commitment]
        encoding_to_use = None if encoding is None else _TX_ENCODING_TO_SOLDERS[encoding]
        config = RpcBlockSubscribeConfig(
            commitment=commitment_to_use,
            encoding=encoding_to_use,
            transaction_details=transaction_details,
            show_rewards=show_rewards,
            max_supported_transaction_version=max_supported_transaction_version,
        )
        req = BlockSubscribe(filter_, config, req_id)
        await self.send_data(req)

    async def block_unsubscribe(
        self,
        subscription: int,
    ) -> None:
        """Unsubscribe from blocks.

        Args:
            subscription: ID of subscription to cancel.
        """
        req_id = self.increment_counter_and_get_id()
        req = BlockUnsubscribe(subscription, req_id)
        await self.send_data(req)
        del self.subscriptions[subscription]

    async def program_subscribe(  # pylint: disable=too-many-arguments
        self,
        program_id: Pubkey,
        commitment: Optional[Commitment] = None,
        encoding: Optional[str] = None,
        data_slice: Optional[types.DataSliceOpts] = None,
        filters: Optional[Sequence[Union[int, types.MemcmpOpts]]] = None,
    ) -> None:
        """Receive notifications when the lamports or data for a given account owned by the program changes.

        Args:
            program_id: The program ID.
            commitment: Commitment level to use.
            encoding: Encoding to use.
            data_slice: (optional) Limit the returned account data using the provided `offset`: <usize> and
            `   length`: <usize> fields; only available for "base58" or "base64" encoding.
            filters: (optional) Options to compare a provided series of bytes with program account data at a particular offset.
                Note: an int entry is converted to a `dataSize` filter.
        """  # noqa: E501 # pylint: disable=line-too-long
        req_id = self.increment_counter_and_get_id()
        if commitment is None and encoding is None and data_slice is None and filters is None:
            config = None
        else:
            encoding_to_use = None if encoding is None else _ACCOUNT_ENCODING_TO_SOLDERS[encoding]
            commitment_to_use = None if commitment is None else _COMMITMENT_TO_SOLDERS[commitment]
            data_slice_to_use = (
                None if data_slice is None else UiDataSliceConfig(offset=data_slice.offset, length=data_slice.length)
            )
            account_config = RpcAccountInfoConfig(
                encoding=encoding_to_use,
                commitment=commitment_to_use,
                data_slice=data_slice_to_use,
            )
            filters_to_use: Optional[List[Union[int, Memcmp]]] = (
                None if filters is None else [x if isinstance(x, int) else Memcmp(*x) for x in filters]
            )
            config = RpcProgramAccountsConfig(account_config, filters_to_use)
        req = ProgramSubscribe(program_id, config, req_id)
        await self.send_data(req)

    async def program_unsubscribe(
        self,
        subscription: int,
    ) -> None:
        """Unsubscribe from program account notifications.

        Args:
            subscription: ID of subscription to cancel.
        """
        req_id = self.increment_counter_and_get_id()
        req = ProgramUnsubscribe(subscription, req_id)
        await self.send_data(req)
        del self.subscriptions[subscription]

    async def signature_subscribe(
        self,
        signature: Signature,
        commitment: Optional[Commitment] = None,
    ) -> None:
        """Subscribe to a transaction signature to receive notification when the transaction is confirmed.

        Args:
            signature: The transaction signature to subscribe to.
            commitment: Commitment level.
        """
        req_id = self.increment_counter_and_get_id()
        commitment_to_use = None if commitment is None else _COMMITMENT_TO_SOLDERS[commitment]
        config = None if commitment_to_use is None else RpcSignatureSubscribeConfig(commitment=commitment_to_use)
        req = SignatureSubscribe(signature, config, req_id)
        await self.send_data(req)

    async def signature_unsubscribe(
        self,
        subscription: int,
    ) -> None:
        """Unsubscribe from signature notifications.

        Args:
            subscription: ID of subscription to cancel.
        """
        req_id = self.increment_counter_and_get_id()
        req = SignatureUnsubscribe(subscription, req_id)
        await self.send_data(req)
        del self.subscriptions[subscription]

    async def slot_subscribe(self) -> None:
        """Subscribe to receive notification anytime a slot is processed by the validator."""
        req_id = self.increment_counter_and_get_id()
        req = SlotSubscribe(req_id)
        await self.send_data(req)

    async def slot_unsubscribe(
        self,
        subscription: int,
    ) -> None:
        """Unsubscribe from slot notifications.

        Args:
            subscription: ID of subscription to cancel.
        """
        req_id = self.increment_counter_and_get_id()
        req = SlotUnsubscribe(subscription, req_id)
        await self.send_data(req)
        del self.subscriptions[subscription]

    async def slots_updates_subscribe(self) -> None:
        """Subscribe to receive a notification from the validator on a variety of updates on every slot."""
        req_id = self.increment_counter_and_get_id()
        req = SlotsUpdatesSubscribe(req_id)
        await self.send_data(req)

    async def slots_updates_unsubscribe(
        self,
        subscription: int,
    ) -> None:
        """Unsubscribe from slot update notifications.

        Args:
            subscription: ID of subscription to cancel.
        """
        req_id = self.increment_counter_and_get_id()
        req = SlotsUpdatesUnsubscribe(subscription, req_id)
        await self.send_data(req)
        del self.subscriptions[subscription]

    async def root_subscribe(self) -> None:
        """Subscribe to receive notification anytime a new root is set by the validator."""
        req_id = self.increment_counter_and_get_id()
        req = RootSubscribe(req_id)
        await self.send_data(req)

    async def root_unsubscribe(
        self,
        subscription: int,
    ) -> None:
        """Unsubscribe from root notifications.

        Args:
            subscription: ID of subscription to cancel.
        """
        req_id = self.increment_counter_and_get_id()
        req = RootUnsubscribe(subscription, req_id)
        await self.send_data(req)
        del self.subscriptions[subscription]

    async def vote_subscribe(self) -> None:
        """Subscribe to receive notification anytime a new vote is observed in gossip."""
        req_id = self.increment_counter_and_get_id()
        req = VoteSubscribe(req_id)
        await self.send_data(req)

    async def vote_unsubscribe(
        self,
        subscription: int,
    ) -> None:
        """Unsubscribe from vote notifications.

        Args:
            subscription: ID of subscription to cancel.
        """
        req_id = self.increment_counter_and_get_id()
        req = VoteUnsubscribe(subscription, req_id)
        await self.send_data(req)
        del self.subscriptions[subscription]

    def _process_rpc_response(self, raw: str) -> List[Union[Notification, SubscriptionResult]]:
        parsed = parse_websocket_message(raw)
        for item in parsed:
            if isinstance(item, SoldersSubscriptionError):
                subscription = self.sent_subscriptions[item.id]
                self.failed_subscriptions[item.id] = subscription
                raise SubscriptionError(item, subscription)
            if isinstance(item, SubscriptionResult):
                self.subscriptions[item.result] = self.sent_subscriptions[item.id]
        return cast(List[Union[Notification, SubscriptionResult]], parsed)


class connect(ws_connect):  # pylint: disable=invalid-name,too-few-public-methods
    """Solana RPC websocket connector."""

    def __init__(self, uri: str = "ws://localhost:8900", **kwargs: Any) -> None:
        """Init. Kwargs are passed to `websockets.connect`.

        Args:
            uri: The websocket endpoint.
            **kwargs: Keyword arguments for ``websockets.legacy.client.connect``
        """
        # Ensure that create_protocol explicitly creates a SolanaWsClientProtocol
        kwargs.setdefault("create_protocol", SolanaWsClientProtocol)
        super().__init__(uri, **kwargs)

    async def __aenter__(self) -> SolanaWsClientProtocol:
        """Overrides to specify the type of protocol explicitly."""
        protocol = await super().__aenter__()
        return cast(SolanaWsClientProtocol, protocol)
