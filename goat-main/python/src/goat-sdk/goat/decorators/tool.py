from dataclasses import dataclass
from typing import Any, Callable, Type, TypedDict
from typing_extensions import NotRequired
import inspect
from pydantic import BaseModel

from goat.classes.wallet_client_base import WalletClientBase
from goat.utils.snake_case import snake_case


class ToolDecoratorParams(TypedDict):
    """
    Configuration parameters for the Tool decorator

    Attributes:
        name: Optional custom name for the tool. Defaults to the method name in snake_case
        description: A description of what the tool does
        parameters_schema: A Pydantic model class defining the tool's parameters
    """

    name: NotRequired[str]
    description: str
    parameters_schema: Type[BaseModel]


class ParameterMetadata(TypedDict):
    """
    Metadata about a tool's parameters

    Attributes:
        index: The position of the parameters argument in the method signature
        schema: The Pydantic model class used to validate the parameters
    """

    index: int
    schema: Type[BaseModel]


class WalletClientMetadata(TypedDict):
    """
    Metadata about a tool's wallet client parameter

    Attributes:
        index: The position of the wallet client argument in the method signature, or None if not present
    """

    index: int | None


@dataclass
class StoredToolMetadata:
    """
    Metadata stored on a tool method

    Attributes:
        name: The name of the tool
        description: A description of what the tool does
        target: The decorated method
        parameters: Metadata about the tool's parameters
        wallet_client: Metadata about the tool's wallet client parameter
    """

    name: str
    description: str
    target: Callable
    parameters: ParameterMetadata
    wallet_client: WalletClientMetadata


TOOL_METADATA_KEY = "__goat_tool__"


def Tool(tool_params: ToolDecoratorParams) -> Any:
    """
    Decorator that marks a class method as a tool accessible to the LLM.

    The decorator accepts configuration parameters and a Pydantic model for runtime parameter validation.
    When a model is provided, all parameters passed to the tool will be validated against it before
    execution.

    Args:
        tool_params: A ToolDecoratorParams instance containing:
            - description (str): A description of what the tool does
            - name (str, optional): Custom name for the tool. Defaults to the method name in snake_case
            - parameters_schema (Type[BaseModel]): A Pydantic model class to validate parameters at runtime

    Returns:
        A decorated method that includes parameter validation and tool metadata

    Example:
        ```python
        class MyService:
            @Tool({
                "description": "Adds two numbers",
                "parameters_schema": AddNumbersParameters
            })
            def add(self, params: dict) -> int:
                return params["a"] + params["b"]
        ```

    Raises:
        ValueError: If the method signature is invalid or missing required parameters
    """

    def decorator(func):
        # Get validated parameters from method signature
        parameters_indexes = validate_decorator_parameters(func)

        # Store metadata on the function
        tool_metadata = StoredToolMetadata(
            name=tool_params.get("name", snake_case(func.__name__)),
            description=tool_params["description"],
            target=func,
            parameters={
                "index": parameters_indexes["parameters"],
                "schema": tool_params["parameters_schema"],
            },
            wallet_client={"index": parameters_indexes.get("wallet_client")},
        )

        # Store metadata directly on the function
        setattr(func, TOOL_METADATA_KEY, tool_metadata)

        return func

    return decorator


def validate_decorator_parameters(method: Callable) -> dict[str, int]:
    """
    Validates the parameters of a tool method to ensure it has the correct signature.

    Args:
        method: The method being decorated

    Returns:
        Dict containing validated parameter information with keys:
            - parameters: The index of the parameters argument
            - wallet_client: The index of the wallet client argument (if present)

    Raises:
        ValueError: If the method signature is invalid or missing required parameters
    """

    log_prefix = f"Method '{method.__name__}'"
    explainer = (
        "Tool methods must have at least one parameter that is a dictionary "
        "which will be validated against the provided Pydantic model."
    )

    # Get method signature
    sig = inspect.signature(method)
    params = list(sig.parameters.values())

    if len(params) == 0:
        raise ValueError(f"{log_prefix} has no parameters. {explainer}")
    if len(params) > 3:  # we have self, params and wallet_client
        raise ValueError(f"{log_prefix} has {len(params)} parameters. {explainer}")

    # Find parameters that match our requirements
    parameters_index = None
    wallet_client_index = None

    for idx, param in enumerate(params):
        if isinstance(param.annotation, type) and issubclass(param.annotation, dict):
            parameters_index = idx
        elif isinstance(param.annotation, type) and issubclass(
            param.annotation, WalletClientBase
        ):
            wallet_client_index = idx

    if not parameters_index:
        raise ValueError(
            f"{log_prefix} has no parameters parameter.\n\n"
            f"1.) {explainer}\n\n"
            "2.) Ensure that you are using proper type annotations."
        )

    result = {"parameters": parameters_index}
    if wallet_client_index:
        result["wallet_client"] = wallet_client_index

    return result
