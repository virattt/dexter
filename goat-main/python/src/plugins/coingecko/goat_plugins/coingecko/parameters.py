from pydantic import BaseModel, Field
from typing import Optional


class GetTrendingCoinsParameters(BaseModel):
    limit: Optional[int] = Field(
        None,
        description="The number of trending coins to return. Defaults to all coins.",
    )
    include_platform: Optional[bool] = Field(
        None,
        description="Include platform contract addresses (e.g., ETH, BSC) in response",
    )


class GetCoinPriceParameters(BaseModel):
    coin_id: str = Field(
        description="The ID of the coin on CoinGecko (e.g., 'bitcoin', 'ethereum')"
    )
    vs_currency: str = Field(
        description="The target currency to get price in (e.g., 'usd', 'eur', 'jpy')"
    )
    include_market_cap: bool = Field(
        description="Include market cap data in the response"
    )
    include_24hr_vol: bool = Field(
        description="Include 24 hour volume data in the response"
    )
    include_24hr_change: bool = Field(
        description="Include 24 hour price change data in the response"
    )
    include_last_updated_at: bool = Field(
        description="Include last updated timestamp in the response"
    )


class SearchCoinsParameters(BaseModel):
    query: str = Field(
        description="The search query to find coins (e.g., 'bitcoin' or 'btc')"
    )
    exact_match: bool = Field(
        description="Only return exact matches for the search query"
    )
