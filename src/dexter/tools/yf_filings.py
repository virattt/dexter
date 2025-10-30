"""SEC filing tools backed by the yfinance API."""

from __future__ import annotations

import re
from datetime import date
from typing import Iterable, Optional

import requests
from bs4 import BeautifulSoup
from langchain.tools import tool

from dexter.tools.finance.constants import (
    ITEMS_10K_MAP,
    ITEMS_10Q_MAP,
    ITEMS_8K_MAP,
)
from dexter.tools.finance.filings import (
    Filing10KItemsInput,
    Filing10QItemsInput,
    Filing8KItemsInput,
    FilingsInput,
)
from dexter.tools.yf_shared import get_ticker, to_python


def _get_sec_filings(ticker: str) -> list[dict]:
    ticker_obj = get_ticker(ticker)
    try:
        filings = ticker_obj.get_sec_filings()
    except Exception:
        return []
    return filings or []


def _normalise_accession(value: str) -> str:
    return value.replace("-", "").lower()


def _match_accession(haystack: Iterable[dict], accession_number: str) -> Optional[dict]:
    target = _normalise_accession(accession_number)
    for filing in haystack:
        edgar_url = filing.get("edgarUrl", "") or ""
        if target in _normalise_accession(edgar_url):
            return filing
        exhibits = filing.get("exhibits") or {}
        for exhibit_url in exhibits.values():
            if target in _normalise_accession(exhibit_url or ""):
                return filing
    return None


def _select_filing(filings: Iterable[dict], filing_type: str, predicate) -> Optional[dict]:
    matches = [filing for filing in filings if filing.get("type") == filing_type and predicate(filing)]
    if not matches:
        return None
    matches.sort(key=lambda f: f.get("date") or date.min, reverse=True)
    return matches[0]


def _primary_document_url(filing: dict, default_key: str) -> Optional[str]:
    exhibits = filing.get("exhibits") or {}
    if default_key in exhibits:
        return exhibits[default_key]
    for key, url in exhibits.items():
        if url:
            return url
    return filing.get("edgarUrl")


def _download_filing_text(url: str) -> Optional[str]:
    if not url:
        return None
    try:
        response = requests.get(url, timeout=15)
        response.raise_for_status()
    except requests.RequestException:
        return None

    soup = BeautifulSoup(response.text, "html.parser")
    text = soup.get_text("\n")
    return text


def _item_pattern(item_key: str) -> re.Pattern:
    suffix = item_key.split("-", 1)[-1]
    suffix_pattern = re.escape(suffix)
    return re.compile(rf"ITEM\s+{suffix_pattern}(?=\.|\s|:|-|$)", re.IGNORECASE)


def _extract_items(text: str, items_map: dict[str, str], request_filter: Optional[list[str]] = None) -> list[dict]:
    if not text:
        return []

    upper_text = text.upper()
    positions: list[tuple[int, str]] = []
    compiled_patterns = {key: _item_pattern(key) for key in items_map}

    for key, pattern in compiled_patterns.items():
        match = pattern.search(upper_text)
        if match:
            positions.append((match.start(), key))

    if not positions:
        return []

    positions.sort()
    results: list[dict] = []
    for index, (start, key) in enumerate(positions):
        end = positions[index + 1][0] if index + 1 < len(positions) else len(text)
        snippet = text[start:end].strip()
        results.append(
            {
                "number": key,
                "title": items_map[key],
                "text": snippet,
            }
        )

    if request_filter:
        normalized = {item.upper().replace(" ", "") for item in request_filter}
        results = [item for item in results if item["number"].upper().replace(" ", "") in normalized]

    return results


@tool(args_schema=FilingsInput)
def yf_get_filings(
    ticker: str,
    filing_type: Optional[str] = None,
    limit: int = 10,
) -> list[dict]:
    """List recent SEC filing metadata from Yahoo Finance's feed via yfinance.

    Returns filing type, title, publish date, and document URLs to support SEC
    discovery when the agent is configured for the yfinance provider.
    """
    filings = _get_sec_filings(ticker)
    results: list[dict] = []

    for filing in filings:
        if filing_type and filing.get("type") != filing_type:
            continue
        results.append(
            {
                "date": to_python(filing.get("date")),
                "type": filing.get("type"),
                "title": filing.get("title"),
                "edgar_url": filing.get("edgarUrl"),
                "exhibits": filing.get("exhibits"),
            }
        )
        if len(results) >= limit:
            break

    return results


@tool(args_schema=Filing10KItemsInput)
def yf_get_10K_filing_items(
    ticker: str,
    year: int,
    item: list[str] | None = None,
) -> dict:
    """Extract text for specific 10-K items using Yahoo Finance sourced filings.

    Downloads the linked SEC HTML, searches for Items (e.g., `Item-1A`), and
    returns the requested sections so the agent can quote narrative content
    without FinancialDatasets access.
    """
    filings = _get_sec_filings(ticker)
    filing = _select_filing(filings, "10-K", lambda f: isinstance(f.get("date"), date) and f.get("date").year == year)
    if not filing:
        return {
            "error": f"No 10-K filing found for {ticker.upper()} in {year} via yfinance.",
            "items": [],
        }

    doc_url = _primary_document_url(filing, "10-K")
    text = _download_filing_text(doc_url)
    items = _extract_items(text or "", ITEMS_10K_MAP, item)

    return {
        "resource": "filing_items",
        "ticker": ticker.upper(),
        "filing_type": "10-K",
        "year": year,
        "items": items,
        "source_url": doc_url,
    }


@tool(args_schema=Filing10QItemsInput)
def yf_get_10Q_filing_items(
    ticker: str,
    year: int,
    quarter: int,
    item: list[str] | None = None,
) -> dict:
    """Extract 10-Q sections (Item-1, Item-2, etc.) via Yahoo Finance sourced filings.

    Helpful for quarterly MD&A or risk discussions when operating in
    `yfinance` mode.
    """
    quarter = max(1, min(4, quarter))

    def _is_target_quarter(filing: dict) -> bool:
        filing_date = filing.get("date")
        if not isinstance(filing_date, date):
            return False
        filing_quarter = (filing_date.month - 1) // 3 + 1
        return filing_date.year == year and filing_quarter == quarter

    filings = _get_sec_filings(ticker)
    filing = _select_filing(filings, "10-Q", _is_target_quarter)
    if not filing:
        return {
            "error": f"No 10-Q filing for {ticker.upper()} in {year} Q{quarter} via yfinance.",
            "items": [],
        }

    doc_url = _primary_document_url(filing, "10-Q")
    text = _download_filing_text(doc_url)
    items = _extract_items(text or "", ITEMS_10Q_MAP, item)

    return {
        "resource": "filing_items",
        "ticker": ticker.upper(),
        "filing_type": "10-Q",
        "year": year,
        "quarter": quarter,
        "items": items,
        "source_url": doc_url,
    }


@tool(args_schema=Filing8KItemsInput)
def yf_get_8K_filing_items(
    ticker: str,
    accession_number: str,
    item: list[str] | None = None,
) -> dict:
    """Extract 8-K narrative items (e.g., Item-2.02, Item-5.02) using the accession number.

    Matches the specified filing in Yahoo Finance's feed, fetches the SEC HTML,
    and returns the requested sections for disclosure summarisation.
    """
    filings = _get_sec_filings(ticker)
    filing = _match_accession(filings, accession_number)
    if not filing or filing.get("type") != "8-K":
        return {
            "error": f"No 8-K filing with accession {accession_number} found for {ticker.upper()} via yfinance.",
            "items": [],
        }

    doc_url = _primary_document_url(filing, "8-K")
    text = _download_filing_text(doc_url)
    items = _extract_items(text or "", ITEMS_8K_MAP, item)

    return {
        "resource": "filing_items",
        "ticker": ticker.upper(),
        "filing_type": "8-K",
        "accession_number": accession_number,
        "items": items,
        "source_url": doc_url,
    }
