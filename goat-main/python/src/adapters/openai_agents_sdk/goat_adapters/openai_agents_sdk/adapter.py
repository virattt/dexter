from typing import List, Any

import json
from agents import FunctionTool, RunContextWrapper
from goat import ToolBase, WalletClientBase, get_tools

def get_on_chain_tools(wallet: WalletClientBase, plugins: List[Any]) -> List[FunctionTool]:
    """Create OpenAI Agents SDK tools from GOAT tools.

    Args:
        wallet: A wallet client instance
        plugins: List of plugin instances

    Returns:
        List of OpenAI Agents SDK Tool instances configured with the GOAT tools
    """
    tools: List[ToolBase] = get_tools(wallet=wallet, plugins=plugins)

    openai_agents_sdk_tools = []

    for t in tools:
        async def _execute_tool(ctx: RunContextWrapper[Any], args: str) -> str:
            parsed = json.loads(args) if args else {}
            return str(tool.execute(parsed))
    
        schema = t.parameters.model_json_schema()
        # TODO: Consider making custom BaseModel with extra = "forbid"
        schema["additionalProperties"] = False

        # Create a OpenAI Agents SDK Tool for each GOAT tool
        tool = FunctionTool(
            name=t.name,
            description=t.description,
            params_json_schema=schema,
            on_invoke_tool=_execute_tool,
        )

        openai_agents_sdk_tools.append(tool)

    return openai_agents_sdk_tools
