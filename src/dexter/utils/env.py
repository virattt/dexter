import os
from pathlib import Path
from typing import Optional
from dotenv import dotenv_values


# Map model IDs to their required API key environment variable names
MODEL_API_KEY_MAP = {
    "gpt-4.1": "OPENAI_API_KEY",
    "claude-sonnet-4-5": "ANTHROPIC_API_KEY",
    "gemini-3": "GOOGLE_API_KEY",
}

# Map API key names to user-friendly provider names
API_KEY_PROVIDER_NAMES = {
    "OPENAI_API_KEY": "OpenAI",
    "ANTHROPIC_API_KEY": "Anthropic",
    "GOOGLE_API_KEY": "Google",
}


def get_api_key_name(model_id: str) -> Optional[str]:
    """Get the API key environment variable name for a given model ID."""
    return MODEL_API_KEY_MAP.get(model_id)


def check_api_key_exists(api_key_name: str) -> bool:
    """
    Check if an API key exists in the environment or .env file.
    
    Args:
        api_key_name: The name of the API key environment variable
        
    Returns:
        True if the key exists and has a non-empty value, False otherwise
    """
    # First check environment variables (already loaded)
    value = os.getenv(api_key_name)
    if value and value.strip() and not value.strip().startswith("your-"):
        return True
    
    # Also check .env file directly
    env_path = Path(".env")
    if env_path.exists():
        env_values = dotenv_values(env_path)
        value = env_values.get(api_key_name)
        if value and value.strip() and not value.strip().startswith("your-"):
            return True
    
    return False


def prompt_for_api_key(api_key_name: str) -> Optional[str]:
    """
    Prompt the user to enter an API key.
    
    Args:
        api_key_name: The name of the API key environment variable
        
    Returns:
        The API key entered by the user, or None if cancelled
    """
    provider_name = API_KEY_PROVIDER_NAMES.get(api_key_name, api_key_name)
    
    print(f"\n{provider_name} API key is required to continue.")
    print(f"Please enter your {api_key_name}:")
    
    try:
        api_key = input("> ").strip()
        if not api_key:
            print("No API key entered. Cancelled.")
            return None
        return api_key
    except (KeyboardInterrupt, EOFError):
        print("\nCancelled.")
        return None


def save_api_key_to_env(api_key_name: str, api_key_value: str) -> bool:
    """
    Save an API key to the .env file, creating it if it doesn't exist.
    
    Args:
        api_key_name: The name of the API key environment variable
        api_key_value: The API key value to save
        
    Returns:
        True if successful, False otherwise
    """
    env_path = Path(".env")
    
    try:
        lines = []
        key_updated = False
        
        if env_path.exists():
            # Read existing .env file to preserve comments and structure
            with open(env_path, 'r') as f:
                existing_lines = f.readlines()
            
            # Process existing lines
            for line in existing_lines:
                stripped = line.strip()
                # Preserve comments and empty lines
                if not stripped or stripped.startswith('#'):
                    lines.append(line)
                elif '=' in stripped:
                    # Check if this line contains the key we need to update
                    key = stripped.split('=')[0].strip()
                    if key == api_key_name:
                        # Update this line with new value
                        lines.append(f"{api_key_name}={api_key_value}\n")
                        key_updated = True
                    else:
                        # Keep existing line as-is
                        lines.append(line)
                else:
                    # Keep malformed lines as-is
                    lines.append(line)
            
            # If key wasn't found, append it at the end
            if not key_updated:
                # Add a newline if the file doesn't end with one
                if lines and not lines[-1].endswith('\n'):
                    lines.append('\n')
                lines.append(f"{api_key_name}={api_key_value}\n")
        else:
            # Create new .env file with a comment header
            lines.append("# LLM API Keys\n")
            lines.append(f"{api_key_name}={api_key_value}\n")
        
        # Write the file
        with open(env_path, 'w') as f:
            f.writelines(lines)
        
        # Reload environment variables
        from dotenv import load_dotenv
        load_dotenv(override=True)
        
        return True
    except Exception as e:
        print(f"Error saving API key to .env file: {e}")
        return False


def ensure_api_key_for_model(model_id: str) -> bool:
    """
    Ensure that the required API key exists for a given model.
    If it doesn't exist, prompt the user to enter it and save it to .env.
    
    Args:
        model_id: The model ID to check
        
    Returns:
        True if the API key exists or was successfully saved, False otherwise
    """
    api_key_name = get_api_key_name(model_id)
    if not api_key_name:
        print(f"Warning: Unknown model '{model_id}', cannot verify API key.")
        return False
    
    # Check if API key already exists
    if check_api_key_exists(api_key_name):
        return True
    
    # Prompt user for API key
    provider_name = API_KEY_PROVIDER_NAMES.get(api_key_name, api_key_name)
    api_key = prompt_for_api_key(api_key_name)
    
    if not api_key:
        return False
    
    # Save to .env file
    if save_api_key_to_env(api_key_name, api_key):
        print(f"\n✓ {provider_name} API key saved to .env file")
        return True
    else:
        print(f"\n✗ Failed to save {provider_name} API key")
        return False

