from typing import List, Any
import traceback
from crewai.tools import BaseTool
from goat.classes.plugin_base import PluginBase
from litellm import ConfigDict
from pydantic import BaseModel, Field
from goat import WalletClientBase, get_tools
from goat.classes.tool_base import ToolBase

class GoatToolWrapper(BaseTool):
    """A wrapper for executing GOAT SDK tools within a CrewAI environment."""
    name: str
    description: str
    model_config = ConfigDict(arbitrary_types_allowed=True)
    goat_tool: ToolBase = Field(exclude=True)

    def __init__(self, goat_tool: ToolBase):
        if not hasattr(goat_tool, 'parameters') or not issubclass(goat_tool.parameters, BaseModel):
             raise ValueError(f"GOAT tool '{goat_tool.name}' has no Pydantic parameters model defined.")

        basetool_spec = {
            'name': goat_tool.name,
            'description': goat_tool.description,
            'args_schema': goat_tool.parameters,
            'goat_tool': goat_tool,
            'cache_function': lambda _args=None, _result=None: False, # never cache tools
            'result_as_answer': False,
        }
        super().__init__(**basetool_spec)


    def _run(
        self,
        **kwargs: Any
    ) -> Any:
        """Executes the wrapped GOAT tool."""
        try:
            return self.goat_tool.execute(kwargs)
        except Exception as e:
            # Get the full traceback
            error_details = traceback.format_exc()
            raise Exception(f"Error executing tool {self.name}: {error_details}")

def get_crewai_tools(wallet: WalletClientBase, plugins: List[PluginBase]) -> List[BaseTool]:
    """Create CrewAI-compatible tools from GOAT tools.

    Args:
        wallet: A wallet client instance
        plugins: List of plugin instances

    Returns:
        List of BaseTool instances ready for CrewAI Agents.
    """
    raw_tools: List[ToolBase] = get_tools(wallet=wallet, plugins=plugins)
    crewai_tools: List[BaseTool] = []

    for raw_tool in raw_tools:
        if hasattr(raw_tool, 'parameters') and raw_tool.parameters and issubclass(raw_tool.parameters, BaseModel):
            try:
                wrapper = GoatToolWrapper(goat_tool=raw_tool)
                crewai_tools.append(wrapper)
            except Exception as e:
                print(f"Warning: Could not initialize wrapper for GOAT tool '{raw_tool.name}': {e}")
        else:
            print(f"Info: Skipping GOAT tool '{raw_tool.name}' as it lacks a Pydantic parameters model.")


    return crewai_tools