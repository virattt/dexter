from pydantic import BaseModel, Field
from typing import List


class GetPairsByChainAndPairParameters(BaseModel):
    chainId: str = Field(
        ...,
        description="The chain ID of the pair"
    )
    pairId: str = Field(
        ...,
        description="The pair ID to fetch"
    )


class SearchPairsParameters(BaseModel):
    query: str = Field(
        ...,
        description="The search query string"
    )


class GetTokenPairsParameters(BaseModel):
    tokenAddresses: List[str] = Field(
        ...,
        max_items=30,
        description="A list of up to 30 token addresses"
    )
