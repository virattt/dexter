from typing_extensions import Callable
from dexter.tools.financials import get_income_statements
from dexter.tools.financials import get_balance_sheets
from dexter.tools.financials import get_cash_flow_statements
from dexter.tools.filings import get_filings
from dexter.tools.filings import get_10K_filing_items
from dexter.tools.filings import get_10Q_filing_items
from dexter.tools.filings import get_8K_filing_items
from dexter.tools.prices import get_price_snapshot
from dexter.tools.prices import get_prices
from dexter.tools.metrics import get_financial_metrics_snapshot
from dexter.tools.metrics import get_financial_metrics

TOOLS: list[Callable[..., any]] = [
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
]
