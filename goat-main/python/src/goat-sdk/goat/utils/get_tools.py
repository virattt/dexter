from typing import List, Optional
from ..classes.plugin_base import PluginBase
from ..classes.tool_base import ToolBase
from ..classes.wallet_client_base import WalletClientBase


def get_tools(
    wallet: WalletClientBase, plugins: Optional[List[PluginBase]] = None
) -> List[ToolBase]:
    """Get all tools from the wallet and plugins."""
    tools: List[ToolBase] = []
    plugins = plugins or []

    chain = wallet.get_chain()
    core_tools = wallet.get_core_tools()

    for plugin in plugins:
        if not plugin.supports_chain(chain):
            chain_id = f" chain id {chain['id']}" if "id" in chain else ""
            print(
                f"Warning: Plugin {plugin.name} does not support {chain['type']}{chain_id}. Skipping."
            )
            continue

        plugin_tools = plugin.get_tools(wallet)
        tools.extend(plugin_tools)

    return [*core_tools, *tools]
