from langchain.tools import tool
from typing import List, Callable, Literal, Optional
import requests
import os
from pydantic import BaseModel, Field

# Optional Schwab imports - only load if credentials are configured
SCHWAB_AVAILABLE = False
try:
    import pyotp
    from schwab_api import Schwab
    SCHWAB_AVAILABLE = True
except ImportError:
    # Schwab dependencies not installed or incompatible
    pass

####################################
# API Keys and Configuration
####################################
financial_datasets_api_key = os.getenv("FINANCIAL_DATASETS_API_KEY")

####################################
# Schwab Authentication Module
####################################

if SCHWAB_AVAILABLE:
    class SchwabAuth:
        """
        Manages authentication and token refresh for the Schwab API.
        """
        def __init__(self):
            self.api = Schwab()
            self.logged_in = False

        def login(self) -> bool:
            """
            Authenticate with the Schwab API using environment variables.

            Returns:
                bool: True if login successful, False otherwise.
            """
            # Verify required environment variables
            required_vars = ["SCHWAB_USERNAME", "SCHWAB_PASSWORD", "SCHWAB_TOTP"]
            for var in required_vars:
                if not os.environ.get(var):
                    raise EnvironmentError(f"Missing required environment variable: {var}")

            try:
                # Generate TOTP code for login
                totp_secret = os.environ["SCHWAB_TOTP"]

                # Authenticate with Schwab API
                self.logged_in = self.api.login(
                    username=os.environ["SCHWAB_USERNAME"],
                    password=os.environ["SCHWAB_PASSWORD"],
                    totp_secret=totp_secret
                )

                return self.logged_in
            except Exception as e:
                self.logged_in = False
                raise Exception(f"Authentication failed: {str(e)}")

        def ensure_authenticated(self):
            """
            Ensures the API is authenticated, logging in if necessary.

            Returns:
                Schwab: The authenticated Schwab API client.

            Raises:
                Exception: If authentication fails.
            """
            if not self.logged_in:
                success = self.login()
                if not success:
                    raise Exception("Failed to authenticate with Schwab API")

            return self.api

    # Create a singleton instance
    schwab_auth = SchwabAuth()
else:
    schwab_auth = None

####################################
# Financial Datasets Tools
####################################

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

####################################
# Schwab Tools
####################################

class SchwabAccountInput(BaseModel):
    account_id: str = Field(description="The ID of the Schwab account to retrieve information for.")

class SchwabStockInput(BaseModel):
    symbol: str = Field(description="The stock or ETF symbol (e.g., 'AAPL' for Apple, 'SPY' for S&P 500 ETF).")

class SchwabTradeInput(BaseModel):
    account_id: str = Field(description="The ID of the Schwab account to place the trade in.")
    symbol: str = Field(description="The stock or ETF symbol to trade (e.g., 'AAPL', 'VTI').")
    quantity: float = Field(description="Number of shares to buy or sell.")
    side: Literal["buy", "sell"] = Field(description="Trade direction - 'buy' to purchase shares or 'sell' to sell shares.")
    order_type: Literal["market", "limit"] = Field(description="'market' for immediate execution at current price, 'limit' to set a price threshold.")
    limit_price: Optional[float] = Field(default=None, description="For limit orders, the price at which to execute the trade.")

@tool
def get_schwab_accounts() -> dict:
    """Retrieves a list of all Charles Schwab brokerage accounts associated with the authenticated user. Provides account IDs, types (like individual, joint, IRA, etc.), and account names."""
    if not SCHWAB_AVAILABLE:
        return {"error": "Schwab API is not available. Please install schwab-api and pyotp packages and configure credentials."}

    # Ensure we're authenticated
    api = schwab_auth.ensure_authenticated()

    # Get account information
    account_info = api.get_account_info()

    # Return structured data
    if not account_info:
        return {"accounts": []}

    accounts = []
    for account_id, details in account_info.items():
        accounts.append({
            "account_id": account_id,
            "account_type": details.get("account_type", ""),
            "account_name": details.get("account_name", f"Account {account_id}")
        })

    return {"accounts": accounts}

@tool(args_schema=SchwabAccountInput)
def get_schwab_account_info(account_id: str) -> dict:
    """Gets detailed information for a specific Charles Schwab brokerage account. Provides comprehensive details including account balances, available cash, and other account-specific information."""
    if not SCHWAB_AVAILABLE:
        return {"error": "Schwab API is not available. Please install schwab-api and pyotp packages and configure credentials."}

    # Ensure we're authenticated
    api = schwab_auth.ensure_authenticated()

    # Get account information
    account_info = api.get_account_info()

    # Convert account_id to int if it's numeric
    try:
        numeric_account_id = int(account_id)
    except ValueError:
        numeric_account_id = account_id

    # Check if the account exists
    if numeric_account_id not in account_info:
        return {"error": f"Account ID {account_id} not found."}

    # Return the account details
    return {"account_id": account_id, "details": account_info[numeric_account_id]}

@tool(args_schema=SchwabAccountInput)
def view_schwab_positions(account_id: str) -> dict:
    """Retrieves the investment positions (holdings) for a specific Charles Schwab brokerage account. Shows all stocks, ETFs, mutual funds, and other securities currently held, including quantity owned and current market value."""
    if not SCHWAB_AVAILABLE:
        return {"error": "Schwab API is not available. Please install schwab-api and pyotp packages and configure credentials."}

    try:
        # Ensure we're authenticated
        api = schwab_auth.ensure_authenticated()

        # Get account information
        account_info = api.get_account_info()

        # Convert account_id to int if needed
        try:
            numeric_account_id = int(account_id)
        except ValueError:
            numeric_account_id = account_id

        # Check if the account exists
        if numeric_account_id not in account_info:
            return {"error": f"Account ID {account_id} not found."}

        # Extract positions for the selected account
        positions_data = account_info[numeric_account_id].get("positions", [])

        if not positions_data:
            return {"account_id": account_id, "positions": []}

        # Return structured positions data
        positions = []
        for position in positions_data:
            positions.append({
                "symbol": position["symbol"],
                "quantity": position.get("quantity", 0.0),
                "market_value": position.get("market_value", 0.0)
            })

        return {"account_id": account_id, "positions": positions}

    except Exception as e:
        return {"error": f"Error retrieving positions: {str(e)}"}

@tool(args_schema=SchwabStockInput)
def get_schwab_stock_details(symbol: str) -> dict:
    """Retrieves current market data for a specific stock or ETF symbol from Schwab's market data service. Provides real-time or slightly delayed market information including current price, daily change, and trading volume."""
    if not SCHWAB_AVAILABLE:
        return {"error": "Schwab API is not available. Please install schwab-api and pyotp packages and configure credentials."}

    # Ensure we're authenticated
    api = schwab_auth.ensure_authenticated()

    try:
        # Get quote information
        try:
            quotes = api.quote_v2([symbol])
        except Exception as api_error:
            return {
                "symbol": symbol.upper(),
                "error": f"Unable to retrieve data: {str(api_error)}"
            }

        if not quotes:
            return {"symbol": symbol, "error": "No data found"}

        quote_data = quotes[0]
        quote = quote_data["quote"]

        # Extract and structure the data
        result = {
            "symbol": symbol.upper(),
            "price": float(quote.get("last", 0)),
            "change": float(quote.get("change", 0)),
            "volume": int(quote.get("volume", 0))
        }

        # Add additional fields if available
        additional_fields = ["bid", "ask", "high", "low", "open", "close", "dividend", "yield"]
        for field in additional_fields:
            if field in quote:
                result[field] = quote[field]

        return result

    except Exception as e:
        return {
            "symbol": symbol.upper(),
            "error": f"Error retrieving stock details: {str(e)}"
        }

@tool(args_schema=SchwabTradeInput)
def place_schwab_trade(
    account_id: str,
    symbol: str,
    quantity: float,
    side: Literal["buy", "sell"],
    order_type: Literal["market", "limit"],
    limit_price: Optional[float] = None
) -> dict:
    """Places a trade order for stocks or ETFs in a specific Charles Schwab brokerage account. Allows executing buy or sell orders as market orders (executed at current market price) or limit orders (executed only at a specified price or better). NOTE: This is currently a placeholder implementation and does not execute real trades."""
    if not SCHWAB_AVAILABLE:
        return {"error": "Schwab API is not available. Please install schwab-api and pyotp packages and configure credentials."}

    # Ensure we're authenticated
    api = schwab_auth.ensure_authenticated()

    try:
        # Validate inputs
        if quantity <= 0:
            return {"error": "Quantity must be positive."}

        if order_type == "limit" and limit_price is None:
            return {"error": "Limit price is required for limit orders."}

        # Get account information
        account_info = api.get_account_info()

        # Convert account_id to int if needed
        try:
            numeric_account_id = int(account_id)
        except ValueError:
            numeric_account_id = account_id

        # Check if the account exists
        if numeric_account_id not in account_info:
            return {"error": f"Account ID {account_id} not found."}

        # NOTE: This is a placeholder for the actual API call
        # In a real implementation, this would call the appropriate Schwab API methods
        # api.place_order(account_id=numeric_account_id, symbol=symbol, ...)

        # For demonstration purposes, return a simulated successful response
        order_id = "1234567890"  # This would be a real order ID in production

        result = {
            "status": "Success (SIMULATED - NOT A REAL TRADE)",
            "order_id": order_id,
            "action": side.capitalize(),
            "symbol": symbol.upper(),
            "quantity": quantity,
            "order_type": order_type.capitalize(),
            "account_id": account_id
        }

        if order_type == "limit":
            result["limit_price"] = limit_price

        return result

    except Exception as e:
        return {"error": f"Error placing trade: {str(e)}"}

####################################
# Tool Lists
####################################

TOOLS: List[Callable[..., any]] = [
    get_income_statements,
    get_balance_sheets,
    get_cash_flow_statements,
    get_schwab_accounts,
    get_schwab_account_info,
    view_schwab_positions,
    get_schwab_stock_details,
    place_schwab_trade,
]

RISKY_TOOLS = {
    "place_schwab_trade": "This tool will place a REAL trade order in your Schwab account. Confirm before executing."
}