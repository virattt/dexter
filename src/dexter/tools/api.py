import os
import requests
from typing import Optional

####################################
# API Configuration
####################################

coingecko_api_key = os.getenv("COINGECKO_API_KEY")

# Cache for symbol to ID conversions to reduce API calls
_symbol_to_id_cache = {}


def call_api(endpoint: str, params: Optional[dict] = None) -> dict:
    """Helper function to call the CoinGecko Pro API."""
    base_url = "https://pro-api.coingecko.com/api/v3"
    url = f"{base_url}{endpoint}"
    headers = {"x-cg-pro-api-key": coingecko_api_key}
    
    if params is None:
        params = {}
    
    response = requests.get(url, params=params, headers=headers)
    response.raise_for_status()
    return response.json()


def resolve_crypto_identifier(identifier: str) -> str:
    """
    Convert ticker symbol (BTC, ETH) to CoinGecko ID (bitcoin, ethereum).
    If the identifier is already a CoinGecko ID format, returns it as-is.
    
    Args:
        identifier: Either a ticker symbol (e.g., 'BTC') or CoinGecko ID (e.g., 'bitcoin')
    
    Returns:
        CoinGecko ID string
    """
    # Normalize the identifier
    identifier = identifier.lower().strip()
    
    # Check cache first
    if identifier in _symbol_to_id_cache:
        return _symbol_to_id_cache[identifier]
    
    # If it looks like a CoinGecko ID (lowercase with hyphens, no uppercase),
    # try to use it directly first
    if identifier.islower() and ' ' not in identifier:
        try:
            # Verify it's a valid ID by making a quick call
            call_api(f"/coins/{identifier}", params={"localization": "false", "tickers": "false", "community_data": "false", "developer_data": "false"})
            _symbol_to_id_cache[identifier] = identifier
            return identifier
        except:
            pass
    
    # Otherwise, search for the symbol/name
    try:
        search_results = call_api("/search", params={"query": identifier})
        
        # Look for exact symbol match first
        coins = search_results.get("coins", [])
        for coin in coins:
            if coin.get("symbol", "").lower() == identifier.lower():
                coin_id = coin.get("id")
                _symbol_to_id_cache[identifier] = coin_id
                return coin_id
        
        # If no exact match, return the first result's ID
        if coins:
            coin_id = coins[0].get("id")
            _symbol_to_id_cache[identifier] = coin_id
            return coin_id
    except Exception as e:
        raise ValueError(f"Could not resolve cryptocurrency identifier '{identifier}': {e}")
    
    raise ValueError(f"No cryptocurrency found for identifier: {identifier}")

