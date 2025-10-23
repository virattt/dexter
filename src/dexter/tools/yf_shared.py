"""Shared helpers for tools backed by the yfinance API."""

from __future__ import annotations

from datetime import datetime
from typing import Iterable, Optional
from typing import Literal

import pandas as pd
import yfinance as yf


def get_ticker(symbol: str) -> yf.Ticker:
    """Return a yfinance ``Ticker`` instance for the given symbol."""
    return yf.Ticker(symbol.upper())


def frame_to_records(frame: pd.DataFrame | None, limit: Optional[int] = None) -> list[dict]:
    """Transform a financial statement DataFrame into serialisable records."""
    if frame is None or frame.empty:
        return []

    columns = list(frame.columns)
    if limit is not None:
        columns = columns[:limit]

    records: list[dict] = []
    for column in columns:
        series = frame[column]
        record = {
            "period": format_period_label(column),
            "values": {
                str(index): to_python(value) for index, value in series.items()
            },
        }
        records.append(record)
    return records


def load_statement_frame(
    ticker: yf.Ticker,
    base_name: str,
    period: Literal["annual", "quarterly", "ttm"],
) -> pd.DataFrame | None:
    """Load a yfinance statement DataFrame for the requested period."""
    if period == "annual":
        attr = base_name
    elif period == "quarterly":
        attr = f"quarterly_{base_name}"
    elif period == "ttm":
        attr = f"ttm_{base_name}"
    else:
        raise ValueError(f"Unsupported period: {period}")

    frame = getattr(ticker, attr, None)
    if frame is None and period == "ttm":
        frame = getattr(ticker, f"quarterly_{base_name}", None)
    return frame


def to_python(value):
    """Convert pandas/numpy scalars into plain Python types."""
    if value is None:
        return None
    if isinstance(value, (pd.Timestamp, datetime)):
        return value.isoformat()
    try:
        if pd.isna(value):  # type: ignore[arg-type]
            return None
    except TypeError:
        pass
    if hasattr(value, "item"):
        try:
            return value.item()
        except Exception:
            pass
    return value


def format_period_label(column) -> str:
    if isinstance(column, pd.Timestamp):
        return column.date().isoformat()
    if isinstance(column, datetime):
        return column.date().isoformat()
    return str(column)


def apply_period_filters(
    records: list[dict],
    report_period_gt: Optional[str] = None,
    report_period_gte: Optional[str] = None,
    report_period_lt: Optional[str] = None,
    report_period_lte: Optional[str] = None,
) -> list[dict]:
    """Filter records by report period boundaries."""
    if not records or not any([report_period_gt, report_period_gte, report_period_lt, report_period_lte]):
        return records

    gt_date = _parse_iso_date(report_period_gt)
    gte_date = _parse_iso_date(report_period_gte)
    lt_date = _parse_iso_date(report_period_lt)
    lte_date = _parse_iso_date(report_period_lte)

    filtered: list[dict] = []
    for record in records:
        period_str = record.get("period")
        period_date = _parse_iso_date(period_str) if isinstance(period_str, str) else None

        if period_date is None:
            filtered.append(record)
            continue

        if gt_date and period_date <= gt_date:
            continue
        if gte_date and period_date < gte_date:
            continue
        if lt_date and period_date >= lt_date:
            continue
        if lte_date and period_date > lte_date:
            continue

        filtered.append(record)
    return filtered


def _parse_iso_date(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def safe_get(frame: pd.DataFrame | None, labels: Iterable[str], column) -> Optional[float]:
    """Return the first available value for the provided labels in a DataFrame column."""
    if frame is None or frame.empty or column not in getattr(frame, "columns", []):
        return None
    for label in labels:
        if label in frame.index:
            value = frame.loc[label, column]
            return to_python(value)
    return None


def limit_records(records: list[dict], limit: Optional[int]) -> list[dict]:
    """Limit the number of records if a positive limit is provided."""
    if limit is None or limit <= 0:
        return records
    return records[:limit]
