from langchain.tools import tool
from typing import Literal, Optional
from pydantic import BaseModel, Field
from dexter.tools.api import call_api

class FinancialMetricsSnapshotInput(BaseModel):
    """Input for get_financial_metrics_snapshot."""
    ticker: str = Field(..., description="The stock ticker symbol to fetch financial metrics snapshot for. For example, 'AAPL' for Apple.")

@tool(args_schema=FinancialMetricsSnapshotInput)
def get_financial_metrics_snapshot(ticker: str) -> dict:
    """
    Fetches a snapshot of the most current financial metrics for a company, 
    including key indicators like market capitalization, P/E ratio, and dividend yield. 
    Useful for a quick overview of a company's financial health.
    """
    params = {"ticker": ticker}
    data = call_api("/financial-metrics/snapshot/", params)
    return data.get("snapshot", {})

class FinancialMetricsInput(BaseModel):
    """Input for get_financial_metrics."""
    ticker: str = Field(..., description="The stock ticker symbol to fetch financial metrics for. For example, 'AAPL' for Apple.")
    period: Literal["annual", "quarterly", "ttm"] = Field(default="ttm", description="The reporting period. 'annual' for yearly, 'quarterly' for quarterly, and 'ttm' for trailing twelve months.")
    limit: int = Field(default=4, description="The number of past financial statements to retrieve.")
    report_period: Optional[str] = Field(default=None, description="Filter for financial metrics with an exact report period date (YYYY-MM-DD).")
    report_period_gt: Optional[str] = Field(default=None, description="Filter for financial metrics with report periods after this date (YYYY-MM-DD).")
    report_period_gte: Optional[str] = Field(default=None, description="Filter for financial metrics with report periods on or after this date (YYYY-MM-DD).")
    report_period_lt: Optional[str] = Field(default=None, description="Filter for financial metrics with report periods before this date (YYYY-MM-DD).")
    report_period_lte: Optional[str] = Field(default=None, description="Filter for financial metrics with report periods on or before this date (YYYY-MM-DD).")

@tool(args_schema=FinancialMetricsInput)
def get_financial_metrics(
    ticker: str,
    period: Literal["annual", "quarterly", "ttm"] = "ttm",
    limit: int = 4,
    report_period: Optional[str] = None,
    report_period_gt: Optional[str] = None,
    report_period_gte: Optional[str] = None,
    report_period_lt: Optional[str] = None,
    report_period_lte: Optional[str] = None,
) -> dict:
    """
    Retrieves historical financial metrics for a company, such as P/E ratio, 
    revenue per share, and enterprise value, over a specified period. 
    Useful for trend analysis and historical performance evaluation.
    """
    params = {
        "ticker": ticker,
        "period": period,
        "limit": limit,
    }
    if report_period:
        params["report_period"] = report_period
    if report_period_gt:
        params["report_period_gt"] = report_period_gt
    if report_period_gte:
        params["report_period_gte"] = report_period_gte
    if report_period_lt:
        params["report_period_lt"] = report_period_lt
    if report_period_lte:
        params["report_period_lte"] = report_period_lte
    
    data = call_api("/financial-metrics/", params)
    return data.get("financial_metrics", [])