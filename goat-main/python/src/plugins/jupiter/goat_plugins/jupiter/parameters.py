from enum import Enum
from pydantic import BaseModel, Field
from typing import List, Optional


class QuoteGetSwapMode(str, Enum):
    EXACT_IN = "ExactIn"
    EXACT_OUT = "ExactOut"


class GetQuoteParameters(BaseModel):
    inputMint: str = Field(description="The token address of the token to swap from")
    outputMint: str = Field(description="The token address of the token to swap to")
    amount: int = Field(description="The amount of tokens to swap in the tokens base unit")
    slippageBps: Optional[int] = Field(None, description="The slippage in bps")
    dynamicSlippage: Optional[bool] = Field(True, description="Whether to use dynamic slippage")
    onlyDirectRoutes: Optional[bool] = Field(None, description="Whether to only use direct routes")
    swapMode: QuoteGetSwapMode = Field(default=QuoteGetSwapMode.EXACT_IN, description="The swap mode")
    maxAccounts: Optional[int] = Field(32, description="The maximum number of accounts")
    restrictIntermediateTokens: Optional[bool] = Field(None, description="Whether to restrict intermediate tokens")
    platformFeeBps: Optional[int] = Field(None, description="The platform fee in bps")


class SwapInfo(BaseModel):
    ammKey: str = Field(description="The AMM key")
    label: Optional[str] = Field(None, description="The label")
    inputMint: str = Field(description="The token to swap from")
    outputMint: str = Field(description="The token to swap to")
    inAmount: str = Field(description="The amount of tokens to swap")
    outAmount: str = Field(description="The amount of tokens to swap")
    feeAmount: str = Field(description="The fee amount")
    feeMint: str = Field(description="The fee mint")


class PlatformFee(BaseModel):
    amount: str = Field(description="The amount of tokens to swap")
    feeBps: int = Field(description="The platform fee in bps")


class RoutePlanStep(BaseModel):
    swapInfo: SwapInfo = Field(description="The swap info")
    percent: int = Field(description="The percent of the route plan step")


class QuoteResponse(BaseModel):
    inputMint: str = Field(description="The token address of the token to swap from")
    inAmount: str = Field(description="The amount of tokens to swap in the tokens base unit")
    outputMint: str = Field(description="The token address of the token to swap to")
    outAmount: str = Field(description="The amount of tokens to swap in the tokens base unit")
    otherAmountThreshold: str = Field(description="The amount of tokens to swap in the tokens base unit")
    swapMode: QuoteGetSwapMode = Field(description="The swap mode")
    slippageBps: int = Field(description="The slippage in bps")
    computedAutoSlippage: Optional[int] = Field(None, description="The computed auto slippage")
    platformFee: Optional[PlatformFee] = Field(None, description="The platform fee")
    priceImpactPct: float = Field(description="The price impact in percentage")
    routePlan: List[RoutePlanStep] = Field(description="The route plan")
    contextSlot: Optional[int] = Field(None, description="The context slot")
    timeTaken: Optional[float] = Field(None, description="The time taken")


class SwapRequest(BaseModel):
    userPublicKey: str = Field(description="The user public key")
    quoteResponse: QuoteResponse = Field(description="The quote response")


class SwapParameters(BaseModel):
    swapRequest: SwapRequest = Field(description="The swap request")
