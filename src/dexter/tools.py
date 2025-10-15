from langchain.tools import tool
from typing import List, Callable, Literal, Optional, Sequence
import requests
import os
from pydantic import BaseModel, Field

####################################
# Tools
####################################
financial_datasets_api_key = os.getenv("FINANCIAL_DATASETS_API_KEY")
alpaca_api_key = os.getenv("ALPACA_API_KEY")
alpaca_api_secret = os.getenv("ALPACA_API_SECRET")
alpaca_base_url = os.getenv("ALPACA_BASE_URL", "https://paper-api.alpaca.markets")

class FinancialStatementsInput(BaseModel):
    ticker: str = Field(description="The stock ticker symbol to fetch financial statements for. For example, 'AAPL' for Apple.")
    period: Literal["annual", "quarterly", "ttm"] = Field(description="The reporting period for the financial statements. 'annual' for yearly, 'quarterly' for quarterly, and 'ttm' for trailing twelve months.")
    limit: int = Field(default=10, description="The number of past financial statements to retrieve.")
    report_period_gt: Optional[str] = Field(default=None, description="Optional fitler to retrieve financial statements greater than the specified report period.")
    report_period_gte: Optional[str] = Field(default=None, description="Optional fitler to retrieve financial statements greater than or equal to the specified report period.")
    report_period_lt: Optional[str] = Field(default=None, description="Optional fitler to retrieve financial statements less than the specified report period.")
    report_period_lte: Optional[str] = Field(default=None, description="Optional fitler to retrieve financial statements less than or equal to the specified report period.")


def _create_params(
    ticker: str,
    period: Literal["annual", "quarterly", "ttm"],
    limit: int,
    report_period_gt: Optional[str],
    report_period_gte: Optional[str],
    report_period_lt: Optional[str],
    report_period_lte: Optional[str]
) -> dict:
    """Helper function to create params dict for API calls."""
    params = {"ticker": ticker, "period": period, "limit": limit}
    if report_period_gt is not None:
        params["report_period_gt"] = report_period_gt
    if report_period_gte is not None:
        params["report_period_gte"] = report_period_gte
    if report_period_lt is not None:
        params["report_period_lt"] = report_period_lt
    if report_period_lte is not None:
        params["report_period_lte"] = report_period_lte
    return params

def call_api(endpoint: str, params: dict) -> dict:
    """Helper function to call the Financial Datasets API."""
    base_url = "https://api.financialdatasets.ai"
    url = f"{base_url}{endpoint}"
    headers = {"x-api-key": financial_datasets_api_key}
    response = requests.get(url, params=params, headers=headers)
    response.raise_for_status()
    return response.json()

class PlaceTradeInput(BaseModel):
    symbol: str = Field(description="Ticker symbol to trade, for example 'AAPL'.")
    qty: float = Field(gt=0, description="Number of shares to trade. Must be greater than zero.")
    side: Literal["buy", "sell"] = Field(description="Use 'buy' to purchase shares or 'sell' to sell them.")
    order_type: Literal["market", "limit", "stop", "stop_limit", "trailing_stop"] = Field(description="Order type to submit to Alpaca.")
    time_in_force: Literal["day", "gtc", "opg", "cls", "ioc", "fok"] = Field(description="Order time in force, such as 'day' or 'gtc'.")
    limit_price: Optional[float] = Field(default=None, description="Required when placing limit or stop_limit orders.")
    stop_price: Optional[float] = Field(default=None, description="Required when placing stop or stop_limit orders.")
    trail_price: Optional[float] = Field(default=None, description="Optional trail price when placing trailing_stop orders.")
    trail_percent: Optional[float] = Field(default=None, description="Optional trail percent when placing trailing_stop orders.")
    extended_hours: Optional[bool] = Field(default=None, description="Set to true to allow execution during extended hours when supported.")
    client_order_id: Optional[str] = Field(default=None, description="Optional unique identifier for the order.")

def _alpaca_headers() -> dict:
    if not alpaca_api_key or not alpaca_api_secret:
        raise ValueError("Alpaca API credentials are missing. Set ALPACA_API_KEY and ALPACA_API_SECRET environment variables.")
    return {
        "APCA-API-KEY-ID": alpaca_api_key,
        "APCA-API-SECRET-KEY": alpaca_api_secret,
        "Content-Type": "application/json",
    }

def _validate_order_payload(order_type: str, limit_price: Optional[float], stop_price: Optional[float], trail_price: Optional[float], trail_percent: Optional[float]) -> None:
    if order_type in ("limit", "stop_limit") and limit_price is None:
        raise ValueError("limit_price is required for limit and stop_limit orders.")
    if order_type in ("stop", "stop_limit") and stop_price is None:
        raise ValueError("stop_price is required for stop and stop_limit orders.")
    if order_type == "trailing_stop" and not (trail_price or trail_percent):
        raise ValueError("Provide trail_price or trail_percent for trailing_stop orders.")

@tool(args_schema=PlaceTradeInput)
def place_alpaca_order(
    symbol: str,
    qty: float,
    side: Literal["buy", "sell"],
    order_type: Literal["market", "limit", "stop", "stop_limit", "trailing_stop"],
    time_in_force: Literal["day", "gtc", "opg", "cls", "ioc", "fok"],
    limit_price: Optional[float] = None,
    stop_price: Optional[float] = None,
    trail_price: Optional[float] = None,
    trail_percent: Optional[float] = None,
    extended_hours: Optional[bool] = None,
    client_order_id: Optional[str] = None,
) -> dict:
    """Places a trade through the Alpaca trading API."""
    _validate_order_payload(order_type, limit_price, stop_price, trail_price, trail_percent)

    url = f"{alpaca_base_url.rstrip('/')}/v2/orders"
    payload = {
        "symbol": symbol.upper(),
        "qty": qty,
        "side": side,
        "type": order_type,
        "time_in_force": time_in_force,
    }
    if limit_price is not None:
        payload["limit_price"] = limit_price
    if stop_price is not None:
        payload["stop_price"] = stop_price
    if trail_price is not None:
        payload["trail_price"] = trail_price
    if trail_percent is not None:
        payload["trail_percent"] = trail_percent
    if extended_hours is not None:
        payload["extended_hours"] = extended_hours
    if client_order_id is not None:
        payload["client_order_id"] = client_order_id

    headers = _alpaca_headers()
    response = requests.post(url, json=payload, headers=headers)
    response.raise_for_status()
    return response.json()

class GetPositionsInput(BaseModel):
    symbol: Optional[str] = Field(default=None, description="Optional ticker symbol to fetch a specific position. Leave blank to fetch all positions.")

@tool(args_schema=GetPositionsInput)
def get_alpaca_positions(symbol: Optional[str] = None) -> List[dict]:
    """Fetches current positions from the Alpaca trading API."""
    headers = _alpaca_headers()
    base = alpaca_base_url.rstrip("/")
    url = f"{base}/v2/positions/{symbol.upper()}" if symbol else f"{base}/v2/positions"
    response = requests.get(url, headers=headers)
    if response.status_code == 404:
        return []
    response.raise_for_status()
    data = response.json()
    return data if isinstance(data, list) else [data]

class GetOrdersInput(BaseModel):
    status: Optional[Literal["open", "closed", "all"]] = Field(default=None, description="Filter by order status.")
    limit: Optional[int] = Field(default=None, ge=1, le=500, description="Maximum number of orders to return.")
    after: Optional[str] = Field(default=None, description="Return only orders submitted after this ISO8601 timestamp.")
    until: Optional[str] = Field(default=None, description="Return only orders submitted until this ISO8601 timestamp.")
    direction: Optional[Literal["asc", "desc"]] = Field(default=None, description="Sort direction of results.")
    nested: Optional[bool] = Field(default=None, description="If true, include legs of complex orders.")
    side: Optional[Literal["buy", "sell"]] = Field(default=None, description="Filter by order side.")
    symbols: Optional[Sequence[str]] = Field(default=None, description="Optional list of symbols to include, e.g. ['AAPL', 'TSLA'].")
    client_order_id: Optional[str] = Field(default=None, description="Filter by a specific client order id.")

@tool(args_schema=GetOrdersInput)
def get_alpaca_orders(
    status: Optional[Literal["open", "closed", "all"]] = None,
    limit: Optional[int] = None,
    after: Optional[str] = None,
    until: Optional[str] = None,
    direction: Optional[Literal["asc", "desc"]] = None,
    nested: Optional[bool] = None,
    side: Optional[Literal["buy", "sell"]] = None,
    symbols: Optional[Sequence[str]] = None,
    client_order_id: Optional[str] = None,
) -> List[dict]:
    """Retrieves orders from the Alpaca trading API."""
    headers = _alpaca_headers()
    params = {}
    if status:
        params["status"] = status
    if limit:
        params["limit"] = limit
    if after:
        params["after"] = after
    if until:
        params["until"] = until
    if direction:
        params["direction"] = direction
    if nested is not None:
        params["nested"] = str(nested).lower()
    if side:
        params["side"] = side
    if symbols:
        params["symbols"] = ",".join(s.upper() for s in symbols)
    if client_order_id:
        params["client_order_id"] = client_order_id

    url = f"{alpaca_base_url.rstrip('/')}/v2/orders"
    response = requests.get(url, params=params, headers=headers)
    response.raise_for_status()
    return response.json()

@tool
def get_alpaca_account() -> dict:
    """Retrieves account information from the Alpaca trading API."""
    headers = _alpaca_headers()
    url = f"{alpaca_base_url.rstrip('/')}/v2/account"
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    return response.json()

class GetAssetsInput(BaseModel):
    symbol: Optional[str] = Field(default=None, description="Optional symbol to get info for a specific asset.")
    status: Optional[Literal["active", "inactive"]] = Field(default=None, description="Filter by asset status.")
    asset_class: Optional[Literal["us_equity", "crypto"]] = Field(default=None, description="Filter by asset class.")

@tool(args_schema=GetAssetsInput)
def get_alpaca_assets(symbol: Optional[str] = None, status: Optional[Literal["active", "inactive"]] = None, asset_class: Optional[Literal["us_equity", "crypto"]] = None) -> List[dict]:
    """Retrieves asset information from the Alpaca trading API. Useful for checking if symbols are tradable."""
    headers = _alpaca_headers()
    params = {}
    if status:
        params["status"] = status
    if asset_class:
        params["asset_class"] = asset_class
    
    base = alpaca_base_url.rstrip("/")
    if symbol:
        url = f"{base}/v2/assets/{symbol.upper()}"
    else:
        url = f"{base}/v2/assets"
    
    response = requests.get(url, headers=headers, params=params)
    response.raise_for_status()
    data = response.json()
    return data if isinstance(data, list) else [data]

@tool
def get_alpaca_clock() -> dict:
    """Retrieves the current market clock from the Alpaca trading API. Shows if the market is open and next open/close times."""
    headers = _alpaca_headers()
    url = f"{alpaca_base_url.rstrip('/')}/v2/clock"
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    return response.json()

class GetCalendarInput(BaseModel):
    start: Optional[str] = Field(default=None, description="Start date in YYYY-MM-DD format.")
    end: Optional[str] = Field(default=None, description="End date in YYYY-MM-DD format.")

@tool(args_schema=GetCalendarInput)
def get_alpaca_calendar(start: Optional[str] = None, end: Optional[str] = None) -> List[dict]:
    """Retrieves market calendar from the Alpaca trading API. Shows trading days and hours."""
    headers = _alpaca_headers()
    params = {}
    if start:
        params["start"] = start
    if end:
        params["end"] = end
    
    url = f"{alpaca_base_url.rstrip('/')}/v2/calendar"
    response = requests.get(url, headers=headers, params=params)
    response.raise_for_status()
    return response.json()

@tool
def get_alpaca_watchlists() -> List[dict]:
    """Retrieves all watchlists from the Alpaca trading API."""
    headers = _alpaca_headers()
    url = f"{alpaca_base_url.rstrip('/')}/v2/watchlists"
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    return response.json()

class CreateWatchlistInput(BaseModel):
    name: str = Field(description="Name for the new watchlist.")
    symbols: List[str] = Field(description="List of symbols to include in the watchlist, e.g. ['AAPL', 'TSLA'].")

@tool(args_schema=CreateWatchlistInput)
def create_alpaca_watchlist(name: str, symbols: List[str]) -> dict:
    """Creates a new watchlist in the Alpaca trading API."""
    headers = _alpaca_headers()
    url = f"{alpaca_base_url.rstrip('/')}/v2/watchlists"
    payload = {
        "name": name,
        "symbols": [s.upper() for s in symbols]
    }
    response = requests.post(url, json=payload, headers=headers)
    response.raise_for_status()
    return response.json()

class GetAccountActivitiesInput(BaseModel):
    activity_types: Optional[List[str]] = Field(default=None, description="Filter by activity types like 'FILL', 'DIV', 'ACATC', etc.")
    date: Optional[str] = Field(default=None, description="Date in YYYY-MM-DD format to filter activities.")
    until: Optional[str] = Field(default=None, description="Date in YYYY-MM-DD format to get activities until.")
    after: Optional[str] = Field(default=None, description="Date in YYYY-MM-DD format to get activities after.")
    direction: Optional[Literal["asc", "desc"]] = Field(default=None, description="Sort direction.")
    page_size: Optional[int] = Field(default=None, ge=1, le=1000, description="Number of activities per page.")

@tool(args_schema=GetAccountActivitiesInput)
def get_alpaca_account_activities(
    activity_types: Optional[List[str]] = None,
    date: Optional[str] = None,
    until: Optional[str] = None,
    after: Optional[str] = None,
    direction: Optional[Literal["asc", "desc"]] = None,
    page_size: Optional[int] = None
) -> List[dict]:
    """Retrieves account activities/transactions from the Alpaca trading API."""
    headers = _alpaca_headers()
    params = {}
    if activity_types:
        params["activity_types"] = ",".join(activity_types)
    if date:
        params["date"] = date
    if until:
        params["until"] = until
    if after:
        params["after"] = after
    if direction:
        params["direction"] = direction
    if page_size:
        params["page_size"] = page_size
    
    url = f"{alpaca_base_url.rstrip('/')}/v2/account/activities"
    response = requests.get(url, headers=headers, params=params)
    response.raise_for_status()
    return response.json()

class GetPortfolioHistoryInput(BaseModel):
    period: Optional[Literal["1D", "1W", "1M", "3M", "6M", "1A", "all"]] = Field(default=None, description="Time period for the history.")
    timeframe: Optional[Literal["1Min", "5Min", "15Min", "1H", "1D"]] = Field(default=None, description="Timeframe for data points.")
    date_end: Optional[str] = Field(default=None, description="End date in YYYY-MM-DD format.")
    extended_hours: Optional[bool] = Field(default=None, description="Include extended hours data.")

@tool(args_schema=GetPortfolioHistoryInput)
def get_alpaca_portfolio_history(
    period: Optional[Literal["1D", "1W", "1M", "3M", "6M", "1A", "all"]] = None,
    timeframe: Optional[Literal["1Min", "5Min", "15Min", "1H", "1D"]] = None,
    date_end: Optional[str] = None,
    extended_hours: Optional[bool] = None
) -> dict:
    """Retrieves portfolio value history from the Alpaca trading API."""
    headers = _alpaca_headers()
    params = {}
    if period:
        params["period"] = period
    if timeframe:
        params["timeframe"] = timeframe
    if date_end:
        params["date_end"] = date_end
    if extended_hours is not None:
        params["extended_hours"] = str(extended_hours).lower()
    
    url = f"{alpaca_base_url.rstrip('/')}/v2/account/portfolio/history"
    response = requests.get(url, headers=headers, params=params)
    response.raise_for_status()
    return response.json()

@tool(args_schema=FinancialStatementsInput)
def get_income_statements(
    ticker: str,
    period: Literal["annual", "quarterly", "ttm"],
    limit: int = 10,
    report_period_gt: Optional[str] = None,
    report_period_gte: Optional[str] = None,
    report_period_lt: Optional[str] = None,
    report_period_lte: Optional[str] = None
) -> dict:
    """Fetches a company's income statement, detailing its revenues, expenses, and net income over a reporting period. Useful for evaluating a company's profitability and operational efficiency."""
    params = _create_params(ticker, period, limit, report_period_gt, report_period_gte, report_period_lt, report_period_lte)
    data = call_api("/financials/income-statements/", params)
    return data.get("income_statements", {})

@tool(args_schema=FinancialStatementsInput)
def get_balance_sheets(
    ticker: str,
    period: Literal["annual", "quarterly", "ttm"],
    limit: int = 10,
    report_period_gt: Optional[str] = None,
    report_period_gte: Optional[str] = None,
    report_period_lt: Optional[str] = None,
    report_period_lte: Optional[str] = None
) -> dict:
    """Retrieves a company's balance sheet, which provides a snapshot of its assets, liabilities, and shareholders' equity at a specific point in time. Essential for assessing a company's financial position."""
    params = _create_params(ticker, period, limit, report_period_gt, report_period_gte, report_period_lt, report_period_lte)
    data = call_api("/financials/balance-sheets/", params)
    return data.get("balance_sheets", {})

@tool(args_schema=FinancialStatementsInput)
def get_cash_flow_statements(
    ticker: str,
    period: Literal["annual", "quarterly", "ttm"],
    limit: int = 10,
    report_period_gt: Optional[str] = None,
    report_period_gte: Optional[str] = None,
    report_period_lt: Optional[str] = None,
    report_period_lte: Optional[str] = None
) -> dict:
    """Provides a company's cash flow statement, showing how cash is generated and used across operating, investing, and financing activities. Key for understanding a company's liquidity and solvency."""
    params = _create_params(ticker, period, limit, report_period_gt, report_period_gte, report_period_lt, report_period_lte)
    data = call_api("/financials/cash-flow-statements/", params)
    return data.get("cash_flow_statements", {})

TOOLS: List[Callable[..., any]] = [
    get_income_statements,
    get_balance_sheets,
    get_cash_flow_statements,
    place_alpaca_order,
    get_alpaca_positions,
    get_alpaca_orders,
    get_alpaca_account,
    get_alpaca_assets,
    get_alpaca_clock,
    get_alpaca_calendar,
    get_alpaca_watchlists,
    create_alpaca_watchlist,
    get_alpaca_account_activities,
    get_alpaca_portfolio_history,
]

RISKY_TOOLS = {
    "place_alpaca_order": "Places live trade orders via Alpaca."
}  # guardrail: require confirmation
