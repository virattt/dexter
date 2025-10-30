"""News retrieval tools backed by the yfinance API."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Optional

from langchain.tools import tool

from dexter.tools.finance.news import NewsInput
from dexter.tools.yf_shared import get_ticker


def _parse_date(value: Optional[str]) -> Optional[date]:
    """Return a date for YYYY-MM-DD inputs; ignore invalid strings."""
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(timezone.utc)
    return parsed.date()


def _publish_time_to_datetime(timestamp: Optional[int]) -> Optional[datetime]:
    if timestamp in (None, 0):
        return None
    try:
        return datetime.fromtimestamp(int(timestamp), tz=timezone.utc)
    except (TypeError, ValueError, OSError):
        return None


@tool(args_schema=NewsInput)
def yf_get_news(
    ticker: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 5,
) -> dict:
    """Return structured news articles for a ticker via Yahoo Finance / yfinance."""
    ticker_obj = get_ticker(ticker)
    articles = getattr(ticker_obj, "news", None) or []

    start_day = _parse_date(start_date)
    end_day = _parse_date(end_date)

    results: list[dict] = []
    for article in articles:
        publish_dt = _publish_time_to_datetime(article.get("providerPublishTime"))
        publish_day = publish_dt.date() if publish_dt else None

        if start_day and publish_day and publish_day < start_day:
            continue
        if end_day and publish_day and publish_day > end_day:
            continue

        record = {
            "id": article.get("uuid"),
            "title": article.get("title"),
            "publisher": article.get("publisher"),
            "published_at": publish_dt.isoformat() if publish_dt else None,
            "link": article.get("link"),
            "type": article.get("type"),
            "summary": article.get("summary"),
            "tickers": article.get("tickers") or article.get("relatedTickers"),
        }
        results.append(record)
        if limit and len(results) >= limit:
            break

    return {
        "data_source": "yfinance",
        "ticker": ticker.upper(),
        "news": results,
    }
