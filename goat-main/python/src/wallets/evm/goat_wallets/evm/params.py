from pydantic import BaseModel, Field
from typing import Optional, Dict, List, Any

class GetBalanceParameters(BaseModel):
    address: str = Field(
        description="The address to check balance for"
    )
    tokenAddress: Optional[str] = Field(
        description="The token address to check balance for, omit for native currency",
        default=None
    )

class GetTokenInfoByTickerParameters(BaseModel):
    ticker: str = Field(
        description="The ticker symbol of the token to get information for (e.g., USDC, PEPE)"
    )

class ConvertToBaseUnitsParameters(BaseModel):
    amount: str = Field(
        description="The amount of tokens to convert to base units"
    )
    tokenAddress: Optional[str] = Field(
        description="The token address to convert for, omit for native currency",
        default=None
    )

class ConvertFromBaseUnitsParameters(BaseModel):
    amount: str = Field(
        description="The amount in base units to convert to human-readable format"
    )
    tokenAddress: Optional[str] = Field(
        description="The token address to convert for, omit for native currency",
        default=None
    )

class SendTokenParameters(BaseModel):
    recipient: str = Field(
        description="The address to send tokens to"
    )
    amountInBaseUnits: str = Field(
        description="The amount of tokens to send in base units"
    )
    tokenAddress: Optional[str] = Field(
        description="The token address to send, omit for native currency",
        default=None
    )

class GetTokenAllowanceParameters(BaseModel):
    tokenAddress: str = Field(
        description="The token address to check allowance for"
    )
    owner: str = Field(
        description="The owner address"
    )
    spender: str = Field(
        description="The spender address"
    )

class ApproveParameters(BaseModel):
    tokenAddress: str = Field(
        description="The token address to approve"
    )
    spender: str = Field(
        description="The spender address to approve"
    )
    amount: str = Field(
        description="The amount to approve in base units"
    )

class RevokeApprovalParameters(BaseModel):
    tokenAddress: str = Field(
        description="The token address to revoke approval for"
    )
    spender: str = Field(
        description="The spender address to revoke approval from"
    )

class SignTypedDataParameters(BaseModel):
    types: Dict[str, List[Dict[str, str]]] = Field(
        description="The type definitions for the typed data"
    )
    primaryType: str = Field(
        description="The primary type being signed"
    )
    domain: Dict[str, Any] = Field(
        description="The domain data for the signature"
    )
    message: Dict[str, Any] = Field(
        description="The message data being signed"
    )
