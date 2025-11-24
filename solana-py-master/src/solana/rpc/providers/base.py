"""Base RPC Provider."""

from solders.rpc.requests import Body
from typing_extensions import Type

from .core import T


class BaseProvider:
    """Base class for RPC providers to implement."""

    def make_request(self, body: Body, parser: Type[T]) -> T:
        """Make a request to the rpc endpoint."""
        raise NotImplementedError("Providers must implement this method")
