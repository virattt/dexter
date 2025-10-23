"""Price-related tools backed by the yfinance API."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

import pandas as pd
from langchain.tools import tool

from dexter.tools.prices import PriceSnapshotInput, PricesInput
from dexter.tools.yf_shared import get_ticker, to_python

_MINUTE_INTERVALS: dict[int, str] = {
    1: "1m",
    2: "2m",
    5: "5m",
    15: "15m",
    30: "30m",
    60: "60m",
    90: "90m",
}


def _resolve_history_request(
    interval: Literal["minute", "day", "week", "month", "year"],
    multiplier: int,
) -> tuple[str, Optional[str]]:
    """Map the abstract interval to yfinance's interval plus optional resample rule."""
    if interval == "minute":
        if multiplier not in _MINUTE_INTERVALS:
            raise ValueError("yfinance supports minute intervals of 1, 2, 5, 15, 30, 60, or 90 minutes")
        return _MINUTE_INTERVALS[multiplier], None

    if interval == "day":
        if multiplier == 1:
            return "1d", None
        if multiplier == 5:
            return "5d", None
        return "1d", f"{multiplier}D"

    if interval == "week":
        if multiplier == 1:
            return "1wk", None
        return "1d", f"{multiplier}W"

    if interval == "month":
        if multiplier == 1:
            return "1mo", None
        if multiplier == 3:
            return "3mo", None
        return "1d", f"{multiplier}M"

    if interval == "year":
        return "1mo", f"{multiplier}Y"

    raise ValueError(f"Unsupported interval: {interval}")


def _parse_iso_date(value: str) -> datetime:
    try:
        return datetime.fromisoformat(value)
    except ValueError as exc:
        raise ValueError(f"Invalid date '{value}'. Expected YYYY-MM-DD format.") from exc


def _resample_prices(frame: pd.DataFrame, rule: str) -> pd.DataFrame:
    if frame.empty:
        return frame
    agg = {
        "Open": "first",
        "High": "max",
        "Low": "min",
        "Close": "last",
        "Adj Close": "last",
        "Volume": "sum",
        "Dividends": "sum",
        "Stock Splits": "sum",
    }
    resampled = frame.resample(rule).agg(agg)
    resampled = resampled.dropna(how="all")
    return resampled


def _history_to_records(frame: pd.DataFrame) -> list[dict]:
    if frame.empty:
        return []

    frame = frame.dropna(how="all")
    if frame.empty:
        return []

    frame = frame.reset_index()
    time_key = frame.columns[0]
    records: list[dict] = []
    for _, row in frame.iterrows():
        timestamp = row[time_key]
        if isinstance(timestamp, pd.Timestamp):
            ts_value = timestamp.to_pydatetime().isoformat()
        elif isinstance(timestamp, datetime):
            ts_value = timestamp.isoformat()
        else:
            ts_value = str(timestamp)

        records.append(
            {
                "timestamp": ts_value,
                "open": to_python(row.get("Open")),
                "high": to_python(row.get("High")),
                "low": to_python(row.get("Low")),
                "close": to_python(row.get("Close")),
                "adj_close": to_python(row.get("Adj Close")),
                "volume": to_python(row.get("Volume")),
                "dividends": to_python(row.get("Dividends")),
                "stock_splits": to_python(row.get("Stock Splits")),
            }
        )
    return records


@tool(args_schema=PriceSnapshotInput)
def yf_get_price_snapshot(ticker: str) -> dict:
    """Fetch the latest Yahoo Finance quote snapshot (price, volume, market cap).

    Returns fast-moving fields such as last price, day range, previous close,
    and recent volume using yfinance's `fast_info` plus metadata fallbacks. Use
    this for real-time oriented prompts while operating in `yfinance` mode.
    """
    ticker_obj = get_ticker(ticker)
    snapshot: dict[str, Optional[float | str]] = {"ticker": ticker.upper()}

    fast_info = getattr(ticker_obj, "fast_info", None)
    if fast_info is not None:
        snapshot.update(
            {
                "currency": getattr(fast_info, "currency", None),
                "last_price": to_python(getattr(fast_info, "last_price", None)),
                "previous_close": to_python(getattr(fast_info, "previous_close", None)),
                "open": to_python(getattr(fast_info, "open", None)),
                "day_high": to_python(getattr(fast_info, "day_high", None)),
                "day_low": to_python(getattr(fast_info, "day_low", None)),
                "volume": to_python(getattr(fast_info, "last_volume", None)),
                "market_cap": to_python(getattr(fast_info, "market_cap", None)),
            }
        )

    info = getattr(ticker_obj, "info", {}) or {}
    snapshot.setdefault("currency", info.get("currency"))
    snapshot.setdefault("last_price", to_python(info.get("regularMarketPrice")))
    snapshot.setdefault("previous_close", to_python(info.get("regularMarketPreviousClose")))
    snapshot.setdefault("open", to_python(info.get("regularMarketOpen")))
    snapshot.setdefault("day_high", to_python(info.get("regularMarketDayHigh")))
    snapshot.setdefault("day_low", to_python(info.get("regularMarketDayLow")))
    snapshot.setdefault("volume", to_python(info.get("regularMarketVolume")))
    snapshot.setdefault("market_cap", to_python(info.get("marketCap")))

    market_time = info.get("regularMarketTime")
    if isinstance(market_time, (int, float)):
        snapshot["market_time"] = datetime.fromtimestamp(market_time).isoformat()

    return {
        "data_source": "yfinance",
        "snapshot": snapshot,
    }


@tool(args_schema=PricesInput)
def yf_get_prices(
    ticker: str,
    interval: Literal["minute", "day", "week", "month", "year"],
    interval_multiplier: int,
    start_date: str,
    end_date: str,
) -> dict:
    """Download historical OHLCV bars from Yahoo Finance with optional resampling.

    Supports `minute`, `day`, `week`, `month`, and `year` intervals via the
    `interval`/`interval_multiplier` pair and respects `start_date`/`end_date`
    in ISO format. Use this when the agent needs price series but is configured
    to use the yfinance backend instead of FinancialDatasets.
    """
    ticker_obj = get_ticker(ticker)

    base_interval, resample_rule = _resolve_history_request(interval, interval_multiplier)
    start = _parse_iso_date(start_date)
    end = _parse_iso_date(end_date)

    history = ticker_obj.history(start=start, end=end, interval=base_interval, auto_adjust=False)
    if resample_rule:
        history = _resample_prices(history, resample_rule)

    records = _history_to_records(history)
    return {
        "data_source": "yfinance",
        "ticker": ticker.upper(),
        "interval": interval,
        "interval_multiplier": interval_multiplier,
        "start_date": start_date,
        "end_date": end_date,
        "prices": records,
    }
