"""Financial statement tools backed by the yfinance API."""

from __future__ import annotations

from typing import Literal, Optional

from langchain.tools import tool

from dexter.tools.financials import FinancialStatementsInput
from dexter.tools.yf_shared import (
    apply_period_filters,
    frame_to_records,
    get_ticker,
    limit_records,
    load_statement_frame,
)


def _prepare_response(
    ticker: str,
    period: Literal["annual", "quarterly", "ttm"],
    frame,
    limit: int,
    report_period_gt: Optional[str],
    report_period_gte: Optional[str],
    report_period_lt: Optional[str],
    report_period_lte: Optional[str],
    statement_label: str,
) -> dict:
    records = frame_to_records(frame)
    records = apply_period_filters(records, report_period_gt, report_period_gte, report_period_lt, report_period_lte)
    records = limit_records(records, limit)
    return {
        "data_source": "yfinance",
        "ticker": ticker.upper(),
        "statement": statement_label,
        "period": period,
        "results": records,
    }


@tool(args_schema=FinancialStatementsInput)
def yf_get_income_statements(
    ticker: str,
    period: Literal["annual", "quarterly", "ttm"],
    limit: int = 10,
    report_period_gt: Optional[str] = None,
    report_period_gte: Optional[str] = None,
    report_period_lt: Optional[str] = None,
    report_period_lte: Optional[str] = None,
) -> dict:
    """Fetch income statements for the given ticker using yfinance."""
    ticker_obj = get_ticker(ticker)
    frame = load_statement_frame(ticker_obj, "income_stmt", period)
    return _prepare_response(
        ticker,
        period,
        frame,
        limit,
        report_period_gt,
        report_period_gte,
        report_period_lt,
        report_period_lte,
        "income_statement",
    )


@tool(args_schema=FinancialStatementsInput)
def yf_get_balance_sheets(
    ticker: str,
    period: Literal["annual", "quarterly", "ttm"],
    limit: int = 10,
    report_period_gt: Optional[str] = None,
    report_period_gte: Optional[str] = None,
    report_period_lt: Optional[str] = None,
    report_period_lte: Optional[str] = None,
) -> dict:
    """Fetch balance sheets for the given ticker using yfinance."""
    ticker_obj = get_ticker(ticker)
    frame = load_statement_frame(ticker_obj, "balance_sheet", period)
    return _prepare_response(
        ticker,
        period,
        frame,
        limit,
        report_period_gt,
        report_period_gte,
        report_period_lt,
        report_period_lte,
        "balance_sheet",
    )


@tool(args_schema=FinancialStatementsInput)
def yf_get_cash_flow_statements(
    ticker: str,
    period: Literal["annual", "quarterly", "ttm"],
    limit: int = 10,
    report_period_gt: Optional[str] = None,
    report_period_gte: Optional[str] = None,
    report_period_lt: Optional[str] = None,
    report_period_lte: Optional[str] = None,
) -> dict:
    """Fetch cash flow statements for the given ticker using yfinance."""
    ticker_obj = get_ticker(ticker)
    frame = load_statement_frame(ticker_obj, "cashflow", period)
    return _prepare_response(
        ticker,
        period,
        frame,
        limit,
        report_period_gt,
        report_period_gte,
        report_period_lt,
        report_period_lte,
        "cash_flow_statement",
    )
