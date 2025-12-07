import json
import os
from pathlib import Path
from typing import Any, Dict, Optional

SETTINGS_FILE = Path(".dexter/settings.json")

def load_config() -> Dict[str, Any]:
    """
    Load configuration from .dexter/settings.json.
    Returns an empty dict if the file doesn't exist or is invalid.
    """
    if not SETTINGS_FILE.exists():
        return {}
    
    try:
        with open(SETTINGS_FILE, 'r') as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        # If file is corrupt or unreadable, return empty config
        # We might want to log this warning if we had a logger set up here
        return {}

def save_config(config: Dict[str, Any]) -> bool:
    """
    Save configuration to .dexter/settings.json.
    Returns True if successful, False otherwise.
    """
    try:
        # Ensure directory exists
        SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
        
        with open(SETTINGS_FILE, 'w') as f:
            json.dump(config, f, indent=2)
        return True
    except OSError:
        return False

def get_setting(key: str, default: Any = None) -> Any:
    """
    Get a setting value by key.
    """
    config = load_config()
    return config.get(key, default)

def set_setting(key: str, value: Any) -> bool:
    """
    Set a setting value and save to file.
    """
    config = load_config()
    config[key] = value
    return save_config(config)

