"""News retrieval tools backed by the yfinance API."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Optional, Sequence

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


def _parse_datetime(value: Optional[object]) -> Optional[datetime]:
    """Parse ISO 8601 strings or UNIX timestamps into aware datetimes."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(value, tz=timezone.utc)
        except (ValueError, OSError):
            return None
    if isinstance(value, str):
        normalised = value.replace("Z", "+00:00") if value.endswith("Z") else value
        try:
            parsed = datetime.fromisoformat(normalised)
        except ValueError:
            return None
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    return None


def _first_url(candidates: Sequence[object]) -> Optional[str]:
    for candidate in candidates:
        if not candidate:
            continue
        if isinstance(candidate, dict):
            url = candidate.get("url")
            if url:
                return url
        elif isinstance(candidate, str):
            return candidate
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
        content = article.get("content") or article

        publish_dt = _parse_datetime(
            content.get("pubDate")
            or content.get("displayTime")
            or article.get("providerPublishTime")
        )
        publish_day = publish_dt.date() if publish_dt else None

        if start_day and publish_day and publish_day < start_day:
            continue
        if end_day and publish_day and publish_day > end_day:
            continue

        provider = content.get("provider") or {}
        tickers: Optional[object] = (
            content.get("tickers")
            or content.get("relatedTickers")
            or content.get("symbols")
        )
        if isinstance(tickers, (set, tuple)):
            tickers = list(tickers)
        elif tickers is not None and not isinstance(tickers, list):
            tickers = [tickers]

        record = {
            "id": content.get("id") or article.get("id") or article.get("uuid"),
            "title": content.get("title"),
            "publisher": provider.get("displayName") if isinstance(provider, dict) else provider,
            "published_at": publish_dt.isoformat() if publish_dt else None,
            "link": _first_url(
                (
                    content.get("clickThroughUrl"),
                    content.get("canonicalUrl"),
                    content.get("previewUrl"),
                )
            ),
            "type": content.get("contentType") or article.get("type"),
            "summary": content.get("summary") or content.get("description"),
            "tickers": tickers,
        }
        results.append(record)
        if limit and len(results) >= limit:
            break

    return {
        "data_source": "yfinance",
        "ticker": ticker.upper(),
        "news": results,
    }
