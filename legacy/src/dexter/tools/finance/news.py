from langchain.tools import tool
from typing import Optional
from pydantic import BaseModel, Field
from dexter.tools.finance.api import call_api

class NewsInput(BaseModel):
    """Input for get_news."""
    ticker: str = Field(..., description="The stock ticker symbol to fetch news for. For example, 'AAPL' for Apple.")
    start_date: Optional[str] = Field(default=None, description="The start date to fetch news from (YYYY-MM-DD).")
    end_date: Optional[str] = Field(default=None, description="The end date to fetch news to (YYYY-MM-DD).")
    limit: int = Field(default=10, description="The number of news articles to retrieve. Max is 100.")

@tool(args_schema=NewsInput)
def get_news(
    ticker: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 5,
) -> dict:
    """
    Retrieves recent news articles for a given company ticker,
    covering financial announcements, market trends, and other significant events.
    Useful for staying up-to-date with market-moving information and investor sentiment.
    """
    params = {
        "ticker": ticker,
        "limit": limit,
    }
    if start_date:
        params["start_date"] = start_date
    if end_date:
        params["end_date"] = end_date
    
    data = call_api("/news/", params)
    return data.get("news", [])
