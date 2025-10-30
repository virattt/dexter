from typing import Literal

from typing_extensions import Callable

from dexter.tools.finance.estimates import get_analyst_estimates
from dexter.tools.finance.filings import (
    get_10K_filing_items,
    get_10Q_filing_items,
    get_8K_filing_items,
    get_filings,
)
from dexter.tools.finance.fundamentals import (
    get_balance_sheets,
    get_cash_flow_statements,
    get_income_statements,
)
from dexter.tools.finance.metrics import (
    get_financial_metrics,
    get_financial_metrics_snapshot,
)
from dexter.tools.finance.news import get_news
from dexter.tools.finance.prices import get_price_snapshot, get_prices
from dexter.tools.yf_filings import (
    yf_get_10K_filing_items,
    yf_get_10Q_filing_items,
    yf_get_8K_filing_items,
    yf_get_filings,
)
from dexter.tools.yf_financials import (
    yf_get_balance_sheets,
    yf_get_cash_flow_statements,
    yf_get_income_statements,
)
from dexter.tools.yf_metrics import (
    yf_get_financial_metrics,
    yf_get_financial_metrics_snapshot,
)
from dexter.tools.yf_prices import yf_get_price_snapshot, yf_get_prices


FINANCIAL_DATASETS_TOOLS: list[Callable[..., any]] = [
    get_income_statements,
    get_balance_sheets,
    get_cash_flow_statements,
    get_10K_filing_items,
    get_10Q_filing_items,
    get_8K_filing_items,
    get_filings,
    get_price_snapshot,
    get_prices,
    get_financial_metrics_snapshot,
    get_financial_metrics,
    get_news,
    get_analyst_estimates,
]

YFINANCE_TOOLS: list[Callable[..., any]] = [
    yf_get_income_statements,
    yf_get_balance_sheets,
    yf_get_cash_flow_statements,
    yf_get_10K_filing_items,
    yf_get_10Q_filing_items,
    yf_get_8K_filing_items,
    yf_get_filings,
    yf_get_price_snapshot,
    yf_get_prices,
    yf_get_financial_metrics_snapshot,
    yf_get_financial_metrics,
]


AVAILABLE_DATA_PROVIDERS: tuple[str, ...] = ("financialdatasets", "yfinance")


def get_tools(
    provider: Literal["financialdatasets", "yfinance"] = "financialdatasets",
) -> list[Callable[..., any]]:
    """Return the tool collection for the requested data provider."""
    provider_key = provider.lower()
    if provider_key == "yfinance":
        return YFINANCE_TOOLS
    return FINANCIAL_DATASETS_TOOLS


TOOLS: list[Callable[..., any]] = get_tools()
