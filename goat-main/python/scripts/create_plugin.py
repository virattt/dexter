#!/usr/bin/env python3

import argparse
from pathlib import Path

def create_project_toml(plugin_dir: Path, plugin_name: str, is_evm: bool, is_solana: bool = False) -> None:
    """Create the pyproject.toml file for the plugin."""
    # Base dependencies
    dependencies = '''python = "^3.10"
goat-sdk = "^0.1.0"'''
    
    # Add chain-specific dependencies
    if is_evm:
        dependencies += '\ngoat-sdk-wallet-evm = "^0.1.0"'
    elif is_solana:
        dependencies += '\ngoat-sdk-wallet-solana = "^0.1.0"'
    
    # Dev dependencies
    dev_dependencies = '''ruff = "^0.8.6"
goat-sdk = { path = "../../goat-sdk", develop = true }'''
    
    # Add chain-specific dev dependencies
    if is_evm:
        dev_dependencies += '\ngoat-sdk-wallet-evm = { path = "../../wallets/evm", develop = true }'
    elif is_solana:
        dev_dependencies += '\ngoat-sdk-wallet-solana = { path = "../../wallets/solana", develop = true }'
    
    toml_content = f'''[tool.poetry]
name = "goat-sdk-plugin-{plugin_name}"
version = "0.1.0"
description = "Goat plugin for {plugin_name}"
authors = ["Your Name <your_email@example.com>"]
readme = "README.md"
keywords = ["goat", "sdk", "agents", "ai", "{plugin_name}"]
homepage = "https://ohmygoat.dev/"
repository = "https://github.com/goat-sdk/goat"
packages = [
    {{ include = "goat_plugins/{plugin_name}" }},
]

[tool.poetry.dependencies]
{dependencies}

[tool.poetry.group.test.dependencies]
pytest = "^8.3.4"
pytest-asyncio = "^0.25.0"

[tool.poetry.urls]
"Bug Tracker" = "https://github.com/goat-sdk/goat/issues"

[tool.pytest.ini_options]
addopts = [
  "--import-mode=importlib",
]
pythonpath = "src"
asyncio_default_fixture_loop_scope = "function"

[build-system]
requires = ["poetry-core"]
build-backend = "poetry.core.masonry.api"

[tool.poetry.group.dev.dependencies]
{dev_dependencies}

[tool.ruff]
line-length = 120
target-version = "py312"
'''
    
    with open(plugin_dir / "pyproject.toml", "w") as f:
        f.write(toml_content)

def create_parameters_file(goat_plugins_dir: Path, plugin_name: str) -> None:
    """Create the parameters.py file with example parameters in the goat_plugins directory."""
    parameters_content = '''from pydantic import BaseModel, Field
from typing import Optional


class ExampleQueryParameters(BaseModel):
    query: str = Field(
        description="An example query parameter (e.g., 'search term', 'identifier')"
    )
    limit: Optional[int] = Field(
        None,
        description="Maximum number of results to return. Defaults to no limit.",
    )
    include_metadata: bool = Field(
        default=False,
        description="Include additional metadata in the response"
    )


class ExampleActionParameters(BaseModel):
    target_id: str = Field(
        description="The ID of the target to perform action on"
    )
    action_type: str = Field(
        description="The type of action to perform (e.g., 'create', 'update', 'delete')"
    )
    parameters: Optional[dict] = Field(
        None,
        description="Optional parameters for the action"
    )
'''
    
    with open(goat_plugins_dir / "parameters.py", "w") as f:
        f.write(parameters_content)

def convert_to_python_identifier(name: str, for_class: bool = False) -> str:
    """Convert a kebab-case name to a valid Python identifier.
    
    Args:
        name: The name to convert
        for_class: If True, convert to PascalCase for class names,
                  otherwise convert to snake_case for function/variable names
    """
    # First convert to snake_case
    snake_case = name.replace("-", "_")
    
    if for_class:
        # Convert to PascalCase for class names
        return "".join(word.title() for word in snake_case.split("_"))
    
    return snake_case

def create_service_file(goat_plugins_dir: Path, plugin_name: str, is_evm: bool, is_solana: bool = False) -> None:
    """Create the service.py file with an empty tool."""
    # Convert plugin name to valid Python identifier for class name
    class_name = f"{convert_to_python_identifier(plugin_name, for_class=True)}Service"
    
    # Start with common imports
    service_content = '''from goat.decorators.tool import Tool
from .parameters import ExampleQueryParameters, ExampleActionParameters
'''

    # Add chain-specific imports if needed
    if is_evm:
        service_content += '''from goat_wallets.evm import EVMWalletClient

'''
    elif is_solana:
        service_content += '''from goat_wallets.solana import SolanaWalletClient

'''
    service_content += f'''
class {class_name}:
    def __init__(self, api_key: str):
        self.api_key = api_key

    @Tool({{
        "description": "Example query tool that demonstrates parameter usage",
        "parameters_schema": ExampleQueryParameters
    }})
    async def example_query(self{", wallet_client: EVMWalletClient" if is_evm else ", wallet_client: SolanaWalletClient" if is_solana else ""}, parameters: dict):
        """An example query method that shows how to use parameters."""
        try:
            # Example implementation
            query = parameters["query"]
            limit = parameters.get("limit")
            include_metadata = parameters.get("include_metadata", False)
            
            # Placeholder for actual implementation
            return {{"status": "success", "query": query, "limit": limit, "metadata_included": include_metadata}}
        except Exception as error:
            raise Exception(f"Failed to execute query: {{error}}")

    @Tool({{
        "description": "Example action tool that demonstrates parameter usage",
        "parameters_schema": ExampleActionParameters
    }})
    async def example_action(self{", wallet_client: EVMWalletClient" if is_evm else ", wallet_client: SolanaWalletClient" if is_solana else ""}, parameters: dict):
        """An example action method that shows how to use parameters."""
        try:
            # Example implementation
            target_id = parameters["target_id"]
            action_type = parameters["action_type"]
            action_params = parameters.get("parameters", {{}})
            
            # Placeholder for actual implementation
            return {{"status": "success", "action": action_type, "target": target_id, "params": action_params}}
        except Exception as error:
            raise Exception(f"Failed to execute action: {{error}}")
'''

    with open(goat_plugins_dir / "service.py", "w") as f:
        f.write(service_content)

def create_init_file(goat_plugins_dir: Path, plugin_name: str, is_evm: bool, is_solana: bool = False) -> None:
    """Create the __init__.py file with plugin class."""
    # Convert plugin name to valid Python identifiers
    python_name = convert_to_python_identifier(plugin_name)
    class_base = convert_to_python_identifier(plugin_name, for_class=True)
    class_name = f"{class_base}Service"
    plugin_class = f"{class_base}Plugin"
    options_class = f"{class_base}PluginOptions"
    
    init_content = '''from dataclasses import dataclass
from goat.classes.plugin_base import PluginBase
from .service import {class_name}


@dataclass
class {options_class}:
    """Options for the {plugin_class}."""
    api_key: str  # API key for external service integration


class {plugin_class}(PluginBase):
    def __init__(self, options: {options_class}):
        super().__init__("{plugin_name}", [{class_name}(options.api_key)])

    def supports_chain(self, chain) -> bool:
        return {supports_chain}


def {python_name}(options: {options_class}) -> {plugin_class}:
    return {plugin_class}(options)
'''.format(
        class_name=class_name,
        plugin_class=plugin_class,
        options_class=options_class,
        plugin_name=plugin_name,
        python_name=python_name,
        supports_chain="chain['type'] == 'evm'" if is_evm else "chain['type'] == 'solana'" if is_solana else "True"
    )

    with open(goat_plugins_dir / "__init__.py", "w") as f:
        f.write(init_content)

def main():
    """Main function to create a new GOAT plugin.
    
    This script generates a new plugin package for the GOAT SDK with a standardized structure.
    The plugin name should use hyphens for spaces (e.g., 'my-plugin') and be lowercase.
    Class names will automatically convert hyphens to underscores for valid Python syntax.
    
    Examples:
        # Create an EVM-compatible plugin
        python create_plugin.py my-token --evm
        
        # Create a chain-agnostic plugin
        python create_plugin.py my-service
        
    The script will create:
    1. pyproject.toml with proper dependencies
    2. goat_plugins directory with:
       - parameters.py: Example Pydantic models
       - service.py: Service class with Tool decorators
       - __init__.py: Plugin class and initialization
    3. README.md with usage instructions
    """
    parser = argparse.ArgumentParser(description="Create a new GOAT plugin.")
    parser.add_argument("name", help="Plugin name, e.g. 'myplugin'")
    parser.add_argument("--evm", action="store_true", help="Indicate if plugin is for EVM")
    parser.add_argument("--solana", action="store_true", help="Indicate if plugin is for Solana")
    args = parser.parse_args()
    
    # Ensure only one chain type is specified
    if args.evm and args.solana:
        parser.error("Please specify only one chain type (--evm or --solana)")
    
    plugin_name = args.name.lower()  # Normalize to lowercase
    is_evm = args.evm
    is_solana = args.solana
    
    # Convert plugin name to valid Python identifiers (used throughout the script)
    python_name = convert_to_python_identifier(plugin_name)
    class_base = convert_to_python_identifier(plugin_name, for_class=True)
    
    # Create base plugin directory (relative to python root)
    plugin_dir = Path(__file__).parent.parent / "src" / "plugins" / plugin_name
    plugin_dir.mkdir(parents=True, exist_ok=True)
    
    # Create all required files
    create_project_toml(plugin_dir, plugin_name, is_evm, is_solana)
    
    # Create goat_plugins directory and its contents
    goat_plugins_dir = plugin_dir / "goat_plugins" / plugin_name
    goat_plugins_dir.mkdir(parents=True, exist_ok=True)
    
    # Create all plugin files
    create_parameters_file(goat_plugins_dir, plugin_name)
    create_service_file(goat_plugins_dir, plugin_name, is_evm, is_solana)
    create_init_file(goat_plugins_dir, plugin_name, is_evm, is_solana)
    
    # Create README.md
    # Convert plugin name for Python usage
    python_name = convert_to_python_identifier(plugin_name)
    
    # Determine chain support text
    chain_support = 'EVM chain support' if is_evm else 'Solana chain support' if is_solana else 'Chain-agnostic support'
    
    # Determine additional dependencies
    additional_deps = ''
    if is_evm:
        additional_deps = '# Install required wallet dependency\npoetry add goat-sdk-wallet-evm'
    elif is_solana:
        additional_deps = '# Install required wallet dependency\npoetry add goat-sdk-wallet-solana'
    
    readme_content = f"""# {plugin_name} Plugin for GOAT SDK

A plugin for the GOAT SDK that provides {plugin_name} functionality.

## Installation

```bash
# Install the plugin
poetry add goat-sdk-plugin-{plugin_name}

{additional_deps if additional_deps else ''}
```

## Usage

```python
from goat_plugins.{plugin_name} import {python_name}, {class_base}PluginOptions

# Initialize the plugin
options = {class_base}PluginOptions(
    api_key="your-api-key"
)
plugin = {python_name}(options)
```

## Features

- Example query functionality
- Example action functionality
- {chain_support}

## License

This project is licensed under the terms of the MIT license.
"""
    with open(plugin_dir / "README.md", "w") as f:
        f.write(readme_content)
    
    print(f"Plugin '{plugin_name}' created successfully in {plugin_dir}")

if __name__ == "__main__":
    main()
