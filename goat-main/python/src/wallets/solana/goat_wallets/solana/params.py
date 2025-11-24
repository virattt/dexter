from pydantic import BaseModel, Field
from typing import Optional

class GetBalanceParameters(BaseModel):
    address: str = Field(
        description="The address to check balance for"
    )
    tokenAddress: Optional[str] = Field(
        description="The token mint address to check balance for, omit for native SOL",
        default=None
    )

class GetTokenInfoByTickerParameters(BaseModel):
    ticker: str = Field(
        description="The ticker symbol of the token to get information for (e.g., USDC, USDT)"
    )

class ConvertToBaseUnitsParameters(BaseModel):
    amount: str = Field(
        description="The amount of tokens to convert to base units"
    )
    tokenAddress: Optional[str] = Field(
        description="The token mint address to convert for, omit for native SOL",
        default=None
    )

class ConvertFromBaseUnitsParameters(BaseModel):
    amount: str = Field(
        description="The amount in base units to convert to human-readable format"
    )
    tokenAddress: Optional[str] = Field(
        description="The token mint address to convert for, omit for native SOL",
        default=None
    )

class SendTokenParameters(BaseModel):
    recipient: str = Field(
        description="The address to send tokens to"
    )
    baseUnitsAmount: str = Field(
        description="The amount of tokens to send in base units"
    )
    tokenAddress: Optional[str] = Field(
        description="The token mint address to send, omit for native SOL",
        default=None
    )
