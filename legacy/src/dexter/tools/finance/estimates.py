from langchain.tools import tool
from typing import Literal
from pydantic import BaseModel, Field
from dexter.tools.finance.api import call_api

class AnalystEstimatesInput(BaseModel):
    """Input for get_analyst_estimates."""
    ticker: str = Field(..., description="The stock ticker symbol to fetch analyst estimates for. For example, 'AAPL' for Apple.")
    period: Literal['annual', 'quarterly'] = Field(default='annual', description="The period for the estimates, either 'annual' or 'quarterly'.")

@tool(args_schema=AnalystEstimatesInput)
def get_analyst_estimates(
    ticker: str,
    period: Literal['annual', 'quarterly'] = 'annual',
) -> dict:
    """
    Retrieves analyst estimates for a given company ticker, including metrics like estimated EPS.
    Useful for understanding consensus expectations, assessing future growth prospects, and performing valuation analysis.
    """
    params = {
        "ticker": ticker,
        "period": period,
    }
    
    data = call_api("/analyst-estimates/", params)
    return data.get("analyst_estimates", [])
