from langchain.tools import tool
from typing import Literal
from pydantic import BaseModel, Field
from dexter.tools.finance.api import call_api

####################################
# Tools
####################################

class SegmentedRevenuesInput(BaseModel):
    """Input for the get_segmented_revenues tool."""

    ticker: str = Field(description="The stock ticker symbol to fetch segmented revenues for. For example, 'AAPL' for Apple.")
    period: Literal["annual", "quarterly"] = Field(description="The reporting period for the segmented revenues. 'annual' for yearly, 'quarterly' for quarterly.")
    limit: int = Field(default=10, description="The number of past periods to retrieve.")


@tool(args_schema=SegmentedRevenuesInput)
def get_segmented_revenues(
    ticker: str,
    period: Literal["annual", "quarterly"],
    limit: int = 10,
) -> dict:
    """Provides a detailed breakdown of a company's revenue by operating segments, such as products, services, or geographic regions. Useful for analyzing the composition of a company's revenue."""
    params = {
        "ticker": ticker,
        "period": period,
        "limit": limit
    }
    data = call_api("/financials/segmented-revenues/", params)
    return data.get("segmented_revenues", {})
