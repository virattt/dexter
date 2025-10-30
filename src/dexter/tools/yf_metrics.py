"""Financial metric tools backed by yfinance."""

from __future__ import annotations

from typing import Literal, Optional

from langchain.tools import tool

from dexter.tools.finance.metrics import FinancialMetricsInput, FinancialMetricsSnapshotInput
from dexter.tools.yf_shared import (
    apply_period_filters,
    format_period_label,
    get_ticker,
    limit_records,
    load_statement_frame,
    safe_get,
    to_python,
)


def _get_share_count(ticker_obj) -> Optional[float]:
    fast_info = getattr(ticker_obj, "fast_info", None)
    if fast_info is not None:
        shares = getattr(fast_info, "shares", None)
        if shares:
            return to_python(shares)
    info = getattr(ticker_obj, "info", {}) or {}
    return to_python(info.get("sharesOutstanding"))


@tool(args_schema=FinancialMetricsSnapshotInput)
def yf_get_financial_metrics_snapshot(ticker: str) -> dict:
    """Return headline valuation metrics (market cap, PE, dividend data) from yfinance.

    Pulls from Yahoo Finance's `fast_info` and `info` payloads so the agent can
    answer quick "what's the multiple?" questions without calling the
    FinancialDatasets API.
    """
    ticker_obj = get_ticker(ticker)
    fast_info = getattr(ticker_obj, "fast_info", None)
    info = getattr(ticker_obj, "info", {}) or {}

    snapshot = {
        "ticker": ticker.upper(),
        "currency": getattr(fast_info, "currency", None) if fast_info else info.get("currency"),
        "market_cap": to_python(getattr(fast_info, "market_cap", None) if fast_info else info.get("marketCap")),
        "enterprise_value": to_python(info.get("enterpriseValue")),
        "trailing_pe": to_python(info.get("trailingPE")),
        "forward_pe": to_python(info.get("forwardPE")),
        "peg_ratio": to_python(info.get("pegRatio")),
        "price_to_book": to_python(info.get("priceToBook")),
        "dividend_yield": to_python(info.get("dividendYield")),
        "beta": to_python(info.get("beta")),
        "fifty_day_average": to_python(getattr(fast_info, "fifty_day_average", None) if fast_info else info.get("fiftyDayAverage")),
        "two_hundred_day_average": to_python(getattr(fast_info, "two_hundred_day_average", None) if fast_info else info.get("twoHundredDayAverage")),
        "year_high": to_python(getattr(fast_info, "year_high", None) if fast_info else info.get("fiftyTwoWeekHigh")),
        "year_low": to_python(getattr(fast_info, "year_low", None) if fast_info else info.get("fiftyTwoWeekLow")),
        "payout_ratio": to_python(info.get("payoutRatio")),
        "free_cash_flow": to_python(info.get("freeCashflow")),
        "shares_outstanding": _get_share_count(ticker_obj),
    }

    return {
        "data_source": "yfinance",
        "metrics": snapshot,
    }


def _compute_period_metrics(
    income_frame,
    balance_frame,
    cashflow_frame,
    column,
    shares_outstanding: Optional[float],
) -> dict:
    total_revenue = safe_get(income_frame, ["TotalRevenue", "totalRevenue"], column)
    gross_profit = safe_get(income_frame, ["GrossProfit", "grossProfit"], column)
    operating_income = safe_get(income_frame, ["OperatingIncome", "operatingIncome"], column)
    net_income = safe_get(income_frame, ["NetIncome", "netIncome"], column)
    ebitda = safe_get(income_frame, ["EBITDA", "ebitda"], column)
    eps = safe_get(income_frame, ["DilutedEPS", "dilutedEps"], column)

    total_assets = safe_get(balance_frame, ["TotalAssets", "totalAssets"], column)
    total_liabilities = safe_get(
        balance_frame,
        ["TotalLiabilitiesNetMinorityInterest", "TotalLiabilities", "TotalLiab", "totalLiab"],
        column,
    )
    shareholder_equity = safe_get(
        balance_frame,
        ["StockholdersEquity", "TotalEquityGrossMinorityInterest", "totalStockholderEquity"],
        column,
    )

    operating_cash_flow = safe_get(cashflow_frame, ["OperatingCashFlow", "operatingCashflow"], column)
    free_cash_flow = safe_get(cashflow_frame, ["FreeCashFlow", "freeCashflow"], column)

    metrics = {
        "total_revenue": total_revenue,
        "gross_profit": gross_profit,
        "operating_income": operating_income,
        "net_income": net_income,
        "ebitda": ebitda,
        "eps": eps,
        "operating_cash_flow": operating_cash_flow,
        "free_cash_flow": free_cash_flow,
        "total_assets": total_assets,
        "total_liabilities": total_liabilities,
        "shareholder_equity": shareholder_equity,
    }

    if total_revenue not in (None, 0) and net_income is not None:
        metrics["net_margin"] = net_income / total_revenue
    if total_revenue not in (None, 0) and gross_profit is not None:
        metrics["gross_margin"] = gross_profit / total_revenue
    if total_revenue not in (None, 0) and operating_income is not None:
        metrics["operating_margin"] = operating_income / total_revenue
    if total_revenue not in (None, 0) and free_cash_flow is not None:
        metrics["free_cash_flow_margin"] = free_cash_flow / total_revenue
    if shareholder_equity not in (None, 0) and total_liabilities is not None:
        try:
            metrics["debt_to_equity"] = total_liabilities / shareholder_equity
        except ZeroDivisionError:
            metrics["debt_to_equity"] = None

    if shares_outstanding not in (None, 0) and net_income is not None:
        metrics["net_income_per_share"] = net_income / shares_outstanding
    if shares_outstanding not in (None, 0) and free_cash_flow is not None:
        metrics["free_cash_flow_per_share"] = free_cash_flow / shares_outstanding

    return metrics


@tool(args_schema=FinancialMetricsInput)
def yf_get_financial_metrics(
    ticker: str,
    period: Literal["annual", "quarterly", "ttm"] = "ttm",
    limit: int = 4,
    report_period: Optional[str] = None,
    report_period_gt: Optional[str] = None,
    report_period_gte: Optional[str] = None,
    report_period_lt: Optional[str] = None,
    report_period_lte: Optional[str] = None,
) -> dict:
    """Derive historical fundamentals (margins, cash flow, leverage) from yfinance statements.

    Combines yfinance income, balance, and cash-flow tables to compute margins,
    cash-flow per share, and debt-to-equity for `annual`, `quarterly`, or `ttm`
    periods. Mirrors the FinancialDatasets version so the agent can swap
    providers seamlessly.
    """
    ticker_obj = get_ticker(ticker)
    income_frame = load_statement_frame(ticker_obj, "income_stmt", period)
    balance_frame = load_statement_frame(ticker_obj, "balance_sheet", period)
    cashflow_frame = load_statement_frame(ticker_obj, "cashflow", period)

    candidate_frames = [frame for frame in [income_frame, balance_frame, cashflow_frame] if frame is not None and not frame.empty]
    if not candidate_frames:
        return {
            "data_source": "yfinance",
            "ticker": ticker.upper(),
            "period": period,
            "metrics": [],
        }

    base_frame = candidate_frames[0]
    columns = list(base_frame.columns)

    records: list[dict] = []
    shares_outstanding = _get_share_count(ticker_obj)

    for column in columns:
        metrics = _compute_period_metrics(income_frame, balance_frame, cashflow_frame, column, shares_outstanding)
        record = {
            "period": format_period_label(column),
            "metrics": metrics,
        }
        records.append(record)

    if report_period:
        records = [record for record in records if record.get("period") == report_period]

    records = apply_period_filters(records, report_period_gt, report_period_gte, report_period_lt, report_period_lte)
    records = limit_records(records, limit)

    return {
        "data_source": "yfinance",
        "ticker": ticker.upper(),
        "period": period,
        "metrics": records,
    }
