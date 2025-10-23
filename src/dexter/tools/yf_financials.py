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
    """Return structured income statement records from Yahoo Finance via yfinance.

    Use this when the agent needs revenue, profit, or expense line items without
    hitting the FinancialDatasets API. The `period` flag selects `annual`,
    `quarterly`, or trailing-twelve-month (`ttm`) data and respects optional ISO
    date filters plus a maximum number of periods (`limit`).
    """
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
    """Return balance sheet snapshots from Yahoo Finance via yfinance.

    Includes assets, liabilities, and equity lines so the agent can analyse
    capital structure when the yfinance provider is selected. Supports the same
    period selection and ISO date filtering options as the income statement
    tool.
    """
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
    """Return cash flow statement entries (operating, investing, financing) using yfinance.

    Ideal for questions about liquidity, free cash flow, or capital allocation
    when the agent works in `yfinance` mode. Mirrors the other financial
    statement tools in supported arguments and response shape.
    """
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
