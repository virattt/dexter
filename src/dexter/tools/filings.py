from langchain.tools import tool
from typing import Optional, Literal
from pydantic import BaseModel, Field
from dexter.tools.api import call_api
from dexter.tools.constants import (
    ITEMS_10K_MAP,
    ITEMS_10Q_MAP,
    ITEMS_8K_MAP,
    format_items_description,
)

####################################
# Tools
####################################

class FilingsInput(BaseModel):
    ticker: str = Field(description="The stock ticker symbol to fetch filings for. For example, 'AAPL' for Apple.")
    filing_type: Optional[Literal["10-K", "10-Q", "8-K"]] = Field(
        default=None, 
        description="REQUIRED when searching for a specific filing type. Use '10-K' for annual reports, '10-Q' for quarterly reports, or '8-K' for current reports. If omitted, returns most recent filings of ANY type, which likely won't include the filing you need."
    )
    limit: int = Field(
        default=10, 
        description="Maximum number of filings to return (default: 10). Returns the most recent N filings matching the criteria."
    )


@tool(args_schema=FilingsInput)
def get_filings(
    ticker: str, 
    filing_type: Optional[Literal["10-K", "10-Q", "8-K"]] = None, 
    limit: int = 10
) -> list[dict]:
    """
    Retrieves metadata for SEC filings for a company. Returns accession numbers, filing types, and document URLs.
    
    This tool ONLY returns metadata - it does NOT return the actual text content from filings.
    To retrieve text content, use the specific filing items tools: get_10K_filing_items, 
    get_10Q_filing_items, or get_8K_filing_items.
    """
    params = {"ticker": ticker, "limit": limit}
    if filing_type is not None:
        params["filing_type"] = filing_type
    
    data = call_api("/filings/", params)
    return data.get("filings", [])


class Filing10KItemsInput(BaseModel):
    ticker: str = Field(description="The stock ticker symbol. For example, 'AAPL' for Apple.")
    year: int = Field(description="The year of the 10-K filing. For example, 2023.")
    item: Optional[list[str]] = Field(
        default=None, 
        description=f"Optional list of specific items to retrieve from the 10-K. Valid items are:\n{format_items_description(ITEMS_10K_MAP)}\nIf not specified, all available items will be returned."
    )


@tool(args_schema=Filing10KItemsInput)
def get_10K_filing_items(
    ticker: str,
    year: int,
    item: list[str] | None = None
) -> dict:
    """
    Retrieves specific sections (items) from a company's 10-K annual report.
    
    Use this to extract detailed information from specific sections of a 10-K filing, such as:
    - Item-1: Business
    - Item-1A: Risk Factors
    - Item-7: Management's Discussion and Analysis
    - Item-8: Financial Statements and Supplementary Data
    
    The optional 'item' parameter allows you to filter for specific sections. If not provided,
    all available items will be returned.
    
    Returns a dictionary containing:
    - resource: "filing_items"
    - ticker: The company ticker
    - cik: The company's CIK number
    - filing_type: "10-K"
    - accession_number: The SEC accession number for the filing
    - year: The filing year
    - items: List of items, each with 'number', 'title', and 'text' fields
    """
    params = {
        "ticker": ticker.upper(),
        "filing_type": "10-K",
        "year": year
    }
    
    if item is not None:
        params["item"] = item
    
    data = call_api("/filings/items/", params)
    return data


class Filing10QItemsInput(BaseModel):
    ticker: str = Field(description="The stock ticker symbol. For example, 'AAPL' for Apple.")
    year: int = Field(description="The year of the 10-Q filing. For example, 2023.")
    quarter: int = Field(description="The quarter of the 10-Q filing (1, 2, 3, or 4).")
    item: Optional[list[str]] = Field(
        default=None, 
        description=f"Optional list of specific items to retrieve from the 10-Q. Valid items are:\n{format_items_description(ITEMS_10Q_MAP)}\nIf not specified, all available items will be returned."
    )


@tool(args_schema=Filing10QItemsInput)
def get_10Q_filing_items(
    ticker: str,
    year: int,
    quarter: int,
    item: list[str] | None = None
) -> dict:
    """
    Retrieves specific sections (items) from a company's 10-Q quarterly report.
    
    Use this to extract detailed information from specific sections of a 10-Q filing, such as:
    - Item-1: Financial Statements
    - Item-2: Management's Discussion and Analysis
    - Item-3: Quantitative and Qualitative Disclosures About Market Risk
    - Item-4: Controls and Procedures
    
    The optional 'item' parameter allows you to filter for specific sections. If not provided,
    all available items will be returned.
    
    Returns a dictionary containing:
    - resource: "filing_items"
    - ticker: The company ticker
    - cik: The company's CIK number
    - filing_type: "10-Q"
    - accession_number: The SEC accession number for the filing
    - year: The filing year
    - quarter: The filing quarter (1-4)
    - items: List of items, each with 'number', 'title', and 'text' fields
    """
    params = {
        "ticker": ticker.upper(),
        "filing_type": "10-Q",
        "year": year,
        "quarter": quarter
    }
    
    if item is not None:
        params["item"] = item
    
    data = call_api("/filings/items/", params)
    return data


class Filing8KItemsInput(BaseModel):
    ticker: str = Field(description="The stock ticker symbol. For example, 'AAPL' for Apple.")
    accession_number: str = Field(description="The SEC accession number for the 8-K filing. For example, '0000320193-24-000123'. This can be retrieved from the get_filings tool.")
    item: Optional[list[str]] = Field(
        default=None, 
        description=f"Optional list of specific items to retrieve from the 8-K. Valid items are:\n{format_items_description(ITEMS_8K_MAP)}\nIf not specified, all available items will be returned."
    )


@tool(args_schema=Filing8KItemsInput)
def get_8K_filing_items(
    ticker: str,
    accession_number: str,
    item: list[str] | None = None
) -> dict:
    """
    Retrieves specific sections (items) from a company's 8-K current report.
    
    8-K filings report material events such as acquisitions, financial results, 
    management changes, and other significant corporate events.
    
    The accession_number parameter can be retrieved using the get_filings tool by 
    filtering for 8-K filings.
    
    Common 8-K items include:
    - Item-1.01: Entry into a Material Definitive Agreement
    - Item-2.02: Results of Operations and Financial Condition
    - Item-5.02: Departure/Election of Directors or Principal Officers
    - Item-8.01: Other Events
    
    The optional 'item' parameter allows you to filter for specific sections. If not provided,
    all available items will be returned.
    
    Returns a dictionary containing:
    - resource: "filing_items"
    - ticker: The company ticker
    - cik: The company's CIK number
    - filing_type: "8-K"
    - accession_number: The SEC accession number for the filing
    - items: List of items, each with 'number', 'title', and 'text' fields
    """
    params = {
        "ticker": ticker.upper(),
        "filing_type": "8-K",
        "accession_number": accession_number
    }
    
    if item is not None:
        params["item"] = item
    
    data = call_api("/filings/items/", params)
    return data

