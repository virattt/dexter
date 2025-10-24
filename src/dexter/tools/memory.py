"""
Memory management module for Dexter using Capi API.
Handles storing and retrieving conversation memories within a session.
"""

import os
import requests
from typing import List, Optional, Dict, Any
from dexter.utils.logger import Logger

CAPI_BASE_URL = "https://capi.dev/api/v1"
logger = Logger()


def _get_api_key() -> Optional[str]:
    """Get Capi API key from environment variables."""
    return os.getenv("CAPI_API_KEY")


def _get_headers() -> Dict[str, str]:
    """Get headers for Capi API requests."""
    api_key = _get_api_key()
    if not api_key:
        raise ValueError("CAPI_API_KEY environment variable is not set")
    
    return {
        "Content-Type": "application/json",
        "X-CAPI-API-Key": api_key
    }


def add_memory(user_id: str, text: str, metadata: Optional[Dict[str, Any]] = None) -> bool:
    """
    Store a memory in Capi.
    
    Args:
        user_id: Unique identifier for the user/session
        text: The text content to store
        metadata: Optional metadata to attach to the memory
    
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        headers = _get_headers()
        payload = {
            "userId": user_id,
            "text": text
        }
        
        if metadata:
            payload["metadata"] = metadata
        
        response = requests.post(
            f"{CAPI_BASE_URL}/addMemory",
            headers=headers,
            json=payload,
            timeout=10
        )
        
        response.raise_for_status()
        logger._log("💾 Memory saved successfully")
        return True
        
    except ValueError as e:
        logger._log(f"⚠️  Memory storage disabled: {e}")
        return False
    except requests.exceptions.RequestException as e:
        logger._log(f"⚠️  Failed to store memory: {e}")
        return False
    except Exception as e:
        logger._log(f"⚠️  Unexpected error storing memory: {e}")
        return False


def retrieve_context(user_id: str, query: str, limit: int = 5) -> List[str]:
    """
    Retrieve relevant memories from Capi based on a query.
    
    Args:
        user_id: Unique identifier for the user/session
        query: The query to find relevant memories for
        limit: Maximum number of memories to retrieve (default: 5)
    
    Returns:
        List[str]: List of relevant memory texts, empty list if none found or on error
    """
    try:
        headers = _get_headers()
        payload = {
            "userId": user_id,
            "query": query,
            "limit": limit
        }
        
        response = requests.post(
            f"{CAPI_BASE_URL}/retrieveContext",
            headers=headers,
            json=payload,
            timeout=10
        )
        
        response.raise_for_status()
        data = response.json()
        
        # Extract memory texts from the response
        # Capi returns memories as an array of strings or objects with text field
        memories = data.get("memories", [])
        
        if not memories:
            return []
        
        # Handle different response formats
        extracted_memories = []
        for memory in memories:
            if isinstance(memory, str):
                extracted_memories.append(memory)
            elif isinstance(memory, dict):
                text = memory.get("text", "")
                if text:
                    extracted_memories.append(text)
        
        if extracted_memories:
            logger._log(f"💾 Retrieved {len(extracted_memories)} relevant memory item(s) from past conversation")
        
        return extracted_memories
        
    except ValueError as e:
        logger._log(f"⚠️  Memory retrieval disabled: {e}")
        return []
    except requests.exceptions.RequestException as e:
        logger._log(f"⚠️  Failed to retrieve context: {e}")
        return []
    except Exception as e:
        logger._log(f"⚠️  Unexpected error retrieving context: {e}")
        return []


def clear_memories(user_id: str, silent: bool = False) -> bool:
    """
    Clear all memories for a user/session using Capi's forgetMemory endpoint.
    
    This removes all memories for the given user ID by deleting memories from today
    (olderThanDays=0 would keep today's, so we use a metadata-free delete approach).
    
    Args:
        user_id: Unique identifier for the user/session
    
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        headers = _get_headers()
        
        # Use olderThanDays=0 to delete all memories (including today's)
        # We delete memories older than -1 days (effectively all memories)
        payload = {
            "userId": user_id,
            "olderThanDays": 0  # This removes all memories older than 0 days
        }
        
        response = requests.post(
            f"{CAPI_BASE_URL}/forgetMemory",
            headers=headers,
            json=payload,
            timeout=10
        )
        
        response.raise_for_status()
        data = response.json()
        
        if not silent:
            count = data.get("count", 0)
            if count > 0:
                logger._log(f"✓ Cleared {count} memory item(s) from current session")
            else:
                logger._log("✓ No memories to clear (session was already empty)")
        return True
        
    except ValueError as e:
        logger._log(f"⚠️  Memory clearing disabled: {e}")
        return False
    except requests.exceptions.RequestException as e:
        logger._log(f"⚠️  Failed to clear memories: {e}")
        return False
    except Exception as e:
        logger._log(f"⚠️  Unexpected error clearing memories: {e}")
        return False

