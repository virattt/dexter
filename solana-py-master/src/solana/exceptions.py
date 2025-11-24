"""Exceptions native to solana-py."""

import sys
from typing import Any, Callable, Coroutine, Type, TypeVar


class SolanaExceptionBase(Exception):
    """Base class for Solana-py exceptions."""

    def __init__(self, exc: Exception, func: Callable[[Any], Any], *args: Any, **kwargs: Any) -> None:
        """Init."""
        super().__init__()
        self.error_msg = self._build_error_message(exc, func, *args, **kwargs)

    @staticmethod
    def _build_error_message(
        exc: Exception,
        func: Callable[[Any], Any],
        *args: Any,  # noqa: ARG004
        **kwargs: Any,  # noqa: ARG004
    ) -> str:
        return f"{type(exc)} raised in {func} invokation"


class SolanaRpcException(SolanaExceptionBase):
    """Class for Solana-py RPC exceptions."""

    @staticmethod
    def _build_error_message(
        exc: Exception,
        func: Callable[[Any], Any],  # noqa: ARG004
        *args: Any,
        **kwargs: Any,  # noqa: ARG004
    ) -> str:
        rpc_method = args[1].__class__.__name__
        return f'{type(exc)} raised in "{rpc_method}" endpoint request'


# Because we need to support python version older then 3.10 we don't always have access to ParamSpec,
# so in order to remove code duplication we have to share an untyped function
def _untyped_handle_exceptions(internal_exception_cls, *exception_types_caught):
    def func_decorator(func):
        def argument_decorator(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except exception_types_caught as exc:
                raise internal_exception_cls(exc, func, *args, **kwargs) from exc

        return argument_decorator

    return func_decorator


def _untyped_handle_async_exceptions(
    internal_exception_cls: Type[SolanaRpcException], *exception_types_caught: Type[Exception]
):
    def func_decorator(func):
        async def argument_decorator(*args, **kwargs):
            try:
                return await func(*args, **kwargs)
            except exception_types_caught as exc:
                raise internal_exception_cls(exc, func, *args, **kwargs) from exc

        return argument_decorator

    return func_decorator


T = TypeVar("T")
if sys.version_info >= (3, 10):
    from typing import ParamSpec

    P = ParamSpec("P")

    def handle_exceptions(
        internal_exception_cls: Type[SolanaRpcException], *exception_types_caught: Type[Exception]
    ) -> Callable[[Callable[P, T]], Callable[P, T]]:
        """Decorator for handling non-async exception."""
        return _untyped_handle_exceptions(internal_exception_cls, *exception_types_caught)  # type: ignore

    def handle_async_exceptions(
        internal_exception_cls: Type[SolanaRpcException], *exception_types_caught: Type[Exception]
    ) -> Callable[[Callable[P, Coroutine[Any, Any, T]]], Callable[P, Coroutine[Any, Any, T]]]:
        """Decorator for handling async exception."""
        return _untyped_handle_async_exceptions(internal_exception_cls, *exception_types_caught)  # type: ignore

else:

    def handle_exceptions(internal_exception_cls: Type[SolanaRpcException], *exception_types_caught: Type[Exception]):
        """Decorator for handling non-async exception."""
        return _untyped_handle_exceptions(internal_exception_cls, *exception_types_caught)

    def handle_async_exceptions(
        internal_exception_cls: Type[SolanaRpcException], *exception_types_caught: Type[Exception]
    ):
        """Decorator for handling async exception."""
        return _untyped_handle_async_exceptions(internal_exception_cls, *exception_types_caught)
