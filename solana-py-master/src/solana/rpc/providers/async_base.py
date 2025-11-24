"""Async base RPC Provider."""

from typing import Type

from solders.rpc.requests import Body

from .core import T


class AsyncBaseProvider:
    """Base class for async RPC providers to implement."""

    async def make_request(self, body: Body, parser: Type[T]) -> T:
        """Make a request ot the rpc endpoint."""
        raise NotImplementedError("Providers must implement this method")
