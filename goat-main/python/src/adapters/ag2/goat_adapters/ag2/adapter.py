import inspect
from typing import List, Any, Dict, Callable, Annotated, Protocol, runtime_checkable, cast, Sequence, get_type_hints
from autogen import ConversableAgent, register_function
from autogen.tools import Tool
from goat import WalletClientBase, get_tools
from functools import wraps, update_wrapper

from goat.classes.tool_base import ToolBase

def get_on_chain_tools(wallet: WalletClientBase, plugins: List[Any]) -> List[Tool]:
    """Create typed functions from GOAT tools.

    Args:
        wallet: A wallet client instance
        plugins: List of plugin instances

    Returns:
        Dictionary mapping tool names to ToolFunction objects that are callable
        and also expose tool metadata like name and description
    """
    # Get tools from GOAT
    raw_tools = get_tools(wallet=wallet, plugins=plugins)
    typed_functions = []
    
    # Annotate each tool with the correct parameters, the way AG2 expects them
    for raw_tool in raw_tools:
        if not hasattr(raw_tool, 'parameters') or not raw_tool.parameters:
            continue
            
        parameters_model = raw_tool.parameters
        
        # Get field information from the Pydantic model schema
        schema = parameters_model.model_json_schema()
        properties = schema.get('properties', {})
        
        # Create function with proper annotations
        param_annotations = {}
        for field_name, field_info in properties.items():
            # Get the field type from the model's annotations
            field_type = parameters_model.__annotations__.get(field_name, Any)
            description = field_info.get('description', '')
            
            # Create Annotated type for this parameter
            param_annotations[field_name] = Annotated[field_type, description]
        
        # Create function closure to capture the current tool and annotations
        def make_annotated_tool_function(t: ToolBase, annotations):
            # Create parameter names for the dynamic function
            param_names = list(annotations.keys())
            
            # Create parameter objects
            parameters = []
            for name in param_names:
                param = inspect.Parameter(
                    name=name,
                    kind=inspect.Parameter.POSITIONAL_OR_KEYWORD,
                    annotation=annotations[name]
                )
                parameters.append(param)
            
            # Create new signature
            new_sig = inspect.Signature(parameters=parameters, return_annotation=Any)
            
            # Create function with dynamic parameters
            def tool_function(*args, **kwargs):
                # Map positional args to parameter names
                bound_args = new_sig.bind(*args, **kwargs)
                bound_args.apply_defaults()
                
                # Extract all arguments as a dictionary
                all_params = dict(bound_args.arguments)
                return t.execute(all_params)
            
            # Apply the signature using inspect's technique
            tool_function.__signature__ = new_sig  # type: ignore
            
            # Set annotations and metadata
            tool_function.__annotations__ = annotations
            tool_function.__annotations__['return'] = Any
            tool_function.__name__ = t.name
            tool_function.__qualname__ = t.name
            tool_function.__doc__ = t.description
            
            # Create comprehensive docstring that includes parameter descriptions
            param_docs = []
            for name, annot in annotations.items():
                # Extract description from Annotated type
                if hasattr(annot, '__origin__') and annot.__origin__ is Annotated:
                    _, description = annot.__args__
                    type_name = annot.__args__[0].__name__ if hasattr(annot.__args__[0], '__name__') else str(annot.__args__[0])
                    param_docs.append(f"{name} ({type_name}): {description}")
            
            docstring = f"{t.description}\n\nParameters:\n"
            docstring += "\n".join(f"    {doc}" for doc in param_docs)
            docstring += "\n\nReturns:\n    The result of the tool execution"
            tool_function.__doc__ = docstring
            
            # Wrap the function in a ToolFunction object to preserve metadata
            return Tool(name=t.name, description=t.description, func_or_tool=tool_function)
        
        typed_functions.append(make_annotated_tool_function(raw_tool, param_annotations))
        
    return typed_functions

def register_tools(caller: ConversableAgent, executor: ConversableAgent, wallet: WalletClientBase, plugins: List[Any]) -> None:
    for tool in get_on_chain_tools(wallet, plugins):
        register_function(
            tool,
            caller=caller,
            executor=executor,
            name=tool.name,
            description=tool.description,
        )
