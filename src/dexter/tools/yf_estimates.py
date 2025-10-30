"""Analyst insight tools backed by the yfinance API."""

from __future__ import annotations

from typing import Any

import pandas as pd
from langchain.tools import tool

from dexter.tools.finance.estimates import AnalystEstimatesInput
from dexter.tools.yf_shared import get_ticker, to_python


def _serialise(value: Any) -> Any:
    """Convert pandas objects and nested structures into plain Python data."""
    if value is None:
        return None
    if isinstance(value, pd.DataFrame):
        frame = value.reset_index()
        frame_records = frame.to_dict(orient="records")
        return [{key: _serialise(val) for key, val in record.items()} for record in frame_records]
    if isinstance(value, pd.Series):
        return {to_python(idx): _serialise(val) for idx, val in value.items()}
    if isinstance(value, dict):
        return {key: _serialise(val) for key, val in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_serialise(item) for item in value]
    return to_python(value)


@tool(args_schema=AnalystEstimatesInput)
def yf_get_analyst_estimates(
    ticker: str,
    period: str = "annual",
) -> dict:
    """Return analyst price targets and recommendation trends from yfinance.

    The ``period`` argument is accepted for parity with the FinancialDatasets
    tool but is not used because Yahoo Finance does not segment estimates by
    reporting period.
    """
    ticker_obj = get_ticker(ticker)

    price_targets = _serialise(getattr(ticker_obj, "analyst_price_targets", None))
    analysis = _serialise(getattr(ticker_obj, "analysis", None))
    recommendations_summary = _serialise(getattr(ticker_obj, "recommendations_summary", None))
    recommendations = _serialise(getattr(ticker_obj, "recommendations", None))

    return {
        "data_source": "yfinance",
        "ticker": ticker.upper(),
        "price_targets": price_targets,
        "analysis": analysis,
        "recommendations_summary": recommendations_summary,
        "recommendations": recommendations,
    }
