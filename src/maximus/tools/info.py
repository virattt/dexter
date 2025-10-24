from langchain.tools import tool
from pydantic import BaseModel, Field
from maximus.tools.api import call_api, resolve_crypto_identifier

####################################
# Tools
####################################

class CoinInfoInput(BaseModel):
    """Input for get_coin_info."""
    identifier: str = Field(
        description="The cryptocurrency identifier. Can be either a CoinGecko ID (e.g., 'bitcoin', 'ethereum') or ticker symbol (e.g., 'BTC', 'ETH')."
    )

@tool(args_schema=CoinInfoInput)
def get_coin_info(identifier: str) -> dict:
    """
    Retrieves detailed information about a cryptocurrency including:
    - Basic details (name, symbol, description)
    - Links (homepage, blockchain explorers, social media)
    - Categories and tags
    - Contract addresses (for tokens)
    - Community and developer stats
    
    Use this to get comprehensive background information about a cryptocurrency project.
    """
    coin_id = resolve_crypto_identifier(identifier)
    
    data = call_api(
        f"/coins/{coin_id}",
        params={
            "localization": "false",
            "tickers": "false",
            "market_data": "false",
            "community_data": "true",
            "developer_data": "true",
            "sparkline": "false"
        }
    )
    
    # Extract relevant information
    info = {
        "id": data.get("id"),
        "symbol": data.get("symbol", "").upper(),
        "name": data.get("name"),
        "description": data.get("description", {}).get("en", ""),
        "categories": data.get("categories", []),
        "links": {
            "homepage": data.get("links", {}).get("homepage", []),
            "blockchain_site": data.get("links", {}).get("blockchain_site", [])[:3],  # First 3 explorers
            "official_forum_url": data.get("links", {}).get("official_forum_url", []),
            "chat_url": data.get("links", {}).get("chat_url", []),
            "twitter_screen_name": data.get("links", {}).get("twitter_screen_name"),
            "subreddit_url": data.get("links", {}).get("subreddit_url"),
            "repos_url": data.get("links", {}).get("repos_url", {}).get("github", []),
        },
        "contract_address": data.get("contract_address"),
        "asset_platform_id": data.get("asset_platform_id"),
        "genesis_date": data.get("genesis_date"),
        "sentiment_votes_up_percentage": data.get("sentiment_votes_up_percentage"),
        "sentiment_votes_down_percentage": data.get("sentiment_votes_down_percentage"),
        "market_cap_rank": data.get("market_cap_rank"),
        "coingecko_rank": data.get("coingecko_rank"),
        "coingecko_score": data.get("coingecko_score"),
        "developer_score": data.get("developer_score"),
        "community_score": data.get("community_score"),
        "liquidity_score": data.get("liquidity_score"),
        "public_interest_score": data.get("public_interest_score"),
        "community_data": data.get("community_data", {}),
        "developer_data": data.get("developer_data", {}),
        "last_updated": data.get("last_updated"),
    }
    
    return info


class SearchCryptocurrencyInput(BaseModel):
    """Input for search_cryptocurrency."""
    query: str = Field(
        description="Search query - can be a coin name (e.g., 'Bitcoin'), symbol (e.g., 'BTC'), or partial match."
    )

@tool(args_schema=SearchCryptocurrencyInput)
def search_cryptocurrency(query: str) -> dict:
    """
    Searches for cryptocurrencies by name or symbol.
    
    Returns matching results including:
    - Coin ID, name, symbol
    - Market cap rank
    - Thumbnail image
    
    Useful for finding the correct identifier for a cryptocurrency or discovering related coins.
    """
    data = call_api("/search", params={"query": query})
    
    # Extract coin results
    coins = data.get("coins", [])
    
    formatted_coins = []
    for coin in coins[:20]:  # Limit to top 20 results
        formatted_coins.append({
            "id": coin.get("id"),
            "name": coin.get("name"),
            "symbol": coin.get("symbol", "").upper(),
            "market_cap_rank": coin.get("market_cap_rank"),
            "thumb": coin.get("thumb"),
            "large": coin.get("large"),
        })
    
    # Extract exchange results (optional, but can be useful)
    exchanges = data.get("exchanges", [])
    formatted_exchanges = []
    for exchange in exchanges[:5]:  # Limit to top 5
        formatted_exchanges.append({
            "id": exchange.get("id"),
            "name": exchange.get("name"),
            "market_type": exchange.get("market_type"),
        })
    
    result = {
        "coins": formatted_coins,
        "exchanges": formatted_exchanges,
        "total_coins_found": len(coins),
        "total_exchanges_found": len(exchanges),
    }
    
    return result

