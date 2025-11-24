from typing import List, Any, Dict, get_origin, Optional, Type
import inspect
import traceback
from goat.classes.plugin_base import PluginBase
from pydantic import BaseModel
from goat import WalletClientBase, get_tools
from goat.classes.tool_base import ToolBase
from smolagents import Tool

def python_type_to_json_schema_type(python_type: Type) -> str:
    """Convert Python type to JSON Schema type string."""
    if python_type is str or python_type is Optional[str]:
        return "string"
    elif python_type is int or python_type is Optional[int]:
        return "integer"
    elif python_type is float or python_type is Optional[float]:
        return "number"
    elif python_type is bool or python_type is Optional[bool]:
        return "boolean"
    elif get_origin(python_type) is list or get_origin(python_type) is List:
        return "array"
    elif get_origin(python_type) is dict or get_origin(python_type) is Dict:
        return "object"
    elif python_type is None or python_type is type(None):
        return "null"
    else:
        # For complex types or when unsure, use string as fallback
        return "string"

class GoatToolWrapper(Tool):
    """A wrapper for executing GOAT SDK tools within a Smolagents environment."""
    
    def __init__(self, goat_tool: ToolBase):
        if not hasattr(goat_tool, 'parameters') or not issubclass(goat_tool.parameters, BaseModel):
            raise ValueError(f"GOAT tool '{goat_tool.name}' has no Pydantic parameters model defined.")
        
        self.goat_tool = goat_tool
        self.name = goat_tool.name
        self.description = goat_tool.description
        
        # We have a dynamic forward method, with our own validation
        self.skip_forward_signature_validation = True
        
        # Convert GOAT tool parameters to Smolagents inputs format
        self.inputs = {}
        if hasattr(goat_tool, 'parameters'):
            # Using Pydantic v2 model_fields
            model_fields = getattr(goat_tool.parameters, "model_fields", {})
            for field_name, field_info in model_fields.items():
                # Get field type from annotation
                python_type = field_info.annotation
                
                # Convert Python type to JSON schema type
                field_type = python_type_to_json_schema_type(python_type)
                
                # Get field description
                field_description = getattr(field_info, "description", "") or f"Parameter {field_name}"
                
                self.inputs[field_name] = {
                    "type": field_type,
                    "description": field_description
                }
        
        # Try to determine output_type from the execute method's return annotation
        try:
            return_type = inspect.signature(goat_tool.execute).return_annotation
            if return_type is not inspect.Signature.empty:
                self.output_type = python_type_to_json_schema_type(return_type)
            else:
                # Default to string if no return annotation
                self.output_type = "string"
        except (ValueError, TypeError):
            # If we can't determine the return type, default to string
            self.output_type = "string"
        
        super().__init__()

    def forward(self, **kwargs: Any) -> Any:
        """Executes the wrapped GOAT tool."""
        try:
            return self.goat_tool.execute(kwargs)
        except Exception as e:
            # Get the full traceback
            error_details = traceback.format_exc()
            raise Exception(f"Error executing tool {self.name}: {error_details}")

def get_smolagents_tools(wallet: WalletClientBase, plugins: List[PluginBase]) -> List[Tool]:
    """Create Smolagents-compatible tools from GOAT tools.

    Args:
        wallet: A wallet client instance
        plugins: List of plugin instances

    Returns:
        List of Tool instances ready for Smolagents Agents.
    """
    raw_tools: List[ToolBase] = get_tools(wallet=wallet, plugins=plugins)
    smolagents_tools: List[Tool] = []

    for raw_tool in raw_tools:
        if hasattr(raw_tool, 'parameters') and raw_tool.parameters and issubclass(raw_tool.parameters, BaseModel):
            try:
                wrapper = GoatToolWrapper(goat_tool=raw_tool)
                smolagents_tools.append(wrapper)
            except Exception as e:
                print(f"Warning: Could not initialize wrapper for GOAT tool '{raw_tool.name}': {e}")
        else:
            print(f"Info: Skipping GOAT tool '{raw_tool.name}' as it lacks a Pydantic parameters model.")

    return smolagents_tools