import asyncio
import inspect
import threading
from abc import ABC, abstractmethod
from typing import List, Any, TypeVar, Generic

from goat.classes.tool_base import ToolBase, create_tool
from goat.classes.wallet_client_base import WalletClientBase
from goat.types.chain import Chain
from goat.decorators.tool import StoredToolMetadata, TOOL_METADATA_KEY

TWalletClient = TypeVar("TWalletClient", bound=WalletClientBase)


class PluginBase(Generic[TWalletClient], ABC):
    """
    Abstract base class for plugins that provide tools for wallet interactions.
    """

    def __init__(self, name: str, tool_providers: List[object]):
        """
        Creates a new Plugin instance.

        Args:
            name: The name of the plugin
            tool_providers: Array of class instances that provide tools. Must be actual instances,
                          not classes themselves.
        """
        if not all(
            isinstance(provider, object) and not isinstance(provider, type)
            for provider in tool_providers
        ):
            raise TypeError(
                "All tool providers must be class instances, not classes themselves"
            )

        self.name = name
        self.tool_providers = tool_providers

    @abstractmethod
    def supports_chain(self, chain: Chain) -> bool:
        """
        Checks if the plugin supports a specific blockchain.

        Args:
            chain: The blockchain to check support for

        Returns:
            True if the chain is supported, false otherwise
        """
        pass

    def get_tools(self, wallet_client: TWalletClient) -> List[ToolBase]:
        """
        Retrieves the tools provided by the plugin.

        Args:
            wallet_client: The wallet client to use for tool execution

        Returns:
            An array of tools
        """
        tools: List[ToolBase] = []

        for tool_provider in self.tool_providers:
            # Get all methods of the tool provider instance
            for attr_name in dir(tool_provider):
                attr = getattr(tool_provider, attr_name)
                # Check if the method has tool metadata
                tool_metadata = getattr(attr, TOOL_METADATA_KEY, None)

                if tool_metadata:
                    tools.append(
                        create_tool(
                            {
                                "name": tool_metadata.name,
                                "description": tool_metadata.description,
                                "parameters": tool_metadata.parameters["schema"],
                            },
                            lambda params, tool=tool_metadata: self._execute_tool(
                                tool, tool_provider, wallet_client, params
                            ),
                        )
                    )

        return tools

    def _execute_tool(
        self,
        tool_metadata: StoredToolMetadata,
        tool_provider: Any,
        wallet_client: WalletClientBase,
        params: Any,
    ) -> Any:
        """
        Helper method to execute a tool with the correct arguments.

        Args:
            tool: The tool metadata
            tool_provider: The instance providing the tool
            wallet_client: The wallet client to use
            params: The parameters for the tool

        Returns:
            The result of the tool execution
        """

        def _run_coroutine_in_new_thread(coro):
            """Run a coroutine in a new thread with its own event loop."""
            result = None
            exception = None
            
            def run_coro():
                nonlocal result, exception
                loop = asyncio.new_event_loop()
                try:
                    result = loop.run_until_complete(coro)
                except Exception as e:
                    exception = e
                finally:
                    loop.close()
            
            thread = threading.Thread(target=run_coro)
            thread.start()
            thread.join()
            
            if exception:
                raise exception
            return result

        wallet_client_index = tool_metadata.wallet_client.get("index", 0)
        parameters_index = tool_metadata.parameters.get("index", 0)
        args = [None] * max(wallet_client_index or 0, parameters_index)

        if wallet_client_index is not None:
            args[wallet_client_index - 1] = wallet_client  # type: ignore

        if parameters_index is not None:
            args[parameters_index - 1] = params

        method = getattr(tool_provider, tool_metadata.target.__name__)
        result = method(*args)

        # Handle coroutine results in three cases:
        # 1. If there's an existing event loop and it's not running: use it directly with run_until_complete
        # 2. If there's an existing event loop and it's running: create a new thread with its own event loop to avoid deadlock
        # 3. If there's no event loop: create a new one and use it, then set it as the current event loop to be reused
        if inspect.iscoroutine(result):
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    return _run_coroutine_in_new_thread(result)
                else:
                    return loop.run_until_complete(result)
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                return loop.run_until_complete(result)

        return result
