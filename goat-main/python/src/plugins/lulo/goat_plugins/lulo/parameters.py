from pydantic import BaseModel, Field


class DepositUSDCParameters(BaseModel):
    amount: str = Field(
        description="Amount of USDC to deposit"
    )
