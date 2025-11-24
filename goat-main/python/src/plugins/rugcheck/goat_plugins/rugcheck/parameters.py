from pydantic import BaseModel, Field


class GetTokenReportParameters(BaseModel):
    mint: str = Field(
        description="The token mint address to generate the report for"
    )


class NoParameters(BaseModel):
    pass
