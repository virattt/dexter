from pydantic import BaseModel, Field
from typing import Optional


class GetTokenDetailsParameters(BaseModel):
    address: str = Field(
        description="Token contract address"
    )


class GetTokenTradesParameters(BaseModel):
    address: str = Field(
        description="Token contract address"
    )
    start_date: str = Field(
        description="Start date to filter for (format: YYYY-MM-DD)"
    )
    end_date: str = Field(
        description="End date to filter for (format: YYYY-MM-DD)"
    )


class GetNFTDetailsParameters(BaseModel):
    token_address: str = Field(
        description="NFT contract address"
    )
    nft_id: str = Field(
        description="Specific NFT token ID"
    )


class GetNFTTradesParameters(BaseModel):
    token_address: str = Field(
        description="NFT contract address"
    )
    nft_id: str = Field(
        description="Specific NFT token ID"
    )
    start_date: str = Field(
        description="Start date to filter for (format: YYYY-MM-DD)"
    )
    end_date: str = Field(
        description="End date to filter for (format: YYYY-MM-DD)"
    )


class GetSmartMoneyParameters(BaseModel):
    start_date: str = Field(
        description="Start date to filter for (format: YYYY-MM-DD)"
    )
    end_date: str = Field(
        description="End date to filter for (format: YYYY-MM-DD)"
    )
    token_address: Optional[str] = Field(
        None,
        description="Token address to filter by"
    )


class GetTradingSignalParameters(BaseModel):
    start_date: str = Field(
        description="Start date to filter for (format: YYYY-MM-DD)"
    )
    end_date: str = Field(
        description="End date to filter for (format: YYYY-MM-DD)"
    )
    token_address: Optional[str] = Field(
        None,
        description="Token address to filter by"
    )
