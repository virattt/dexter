#!/usr/bin/env python3
"""
Futu OpenD -> Dexter bridge.

Exposes a tiny local REST API that mirrors the subset of Financial Datasets
endpoints Dexter's market-data tools call, backed by FutuOpenD (futu-api).

Endpoints
  GET /health
  GET /prices/snapshot?ticker=AAPL           -> {"snapshot": {...}}
  GET /prices?ticker=AAPL&interval=day&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD -> {"prices": [...]}
  GET /prices/snapshot/tickers?market=US      -> {"tickers": [{ticker, name}, ...]}
  GET /crypto/prices/snapshot?ticker=BTC-USD  -> {"snapshot": {...}}
  GET /crypto/prices?ticker=BTC-USD&interval=day&start_date=..&end_date=.. -> {"prices": [...]}
  GET /crypto/prices/tickers                  -> {"tickers": [{ticker, name}, ...]}

Run:
  futu-bridge/.venv/bin/python futu-bridge/server.py
Env:
  FUTU_OPEND_HOST (default 127.0.0.1)
  FUTU_OPEND_PORT (default 11111)
  FUTU_BRIDGE_HOST (default 127.0.0.1)
  FUTU_BRIDGE_PORT (default 8765)
"""
import json
import math
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

import pandas as pd

from futu import (
    OpenQuoteContext,
    Market,
    SecurityType,
    SubType,
    RET_OK,
    KLType,
)

OPEND_HOST = os.getenv("FUTU_OPEND_HOST", "127.0.0.1")
OPEND_PORT = int(os.getenv("FUTU_OPEND_PORT", "11111"))
BRIDGE_HOST = os.getenv("FUTU_BRIDGE_HOST", "127.0.0.1")
BRIDGE_PORT = int(os.getenv("FUTU_BRIDGE_PORT", "8765"))

# --- helpers ---------------------------------------------------------------

_lock = threading.Lock()
_ctx = None


def get_ctx():
    global _ctx
    if _ctx is None:
        _ctx = OpenQuoteContext(host=OPEND_HOST, port=OPEND_PORT)
    return _ctx


def safe(v):
    """Make a value JSON-serialisable (no NaN / Timestamp)."""
    if v is None:
        return None
    try:
        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            return None
    except TypeError:
        pass
    if hasattr(v, "isoformat"):  # pandas Timestamp / datetime
        return str(v)
    if isinstance(v, (list, tuple)):
        return [safe(x) for x in v]
    if isinstance(v, dict):
        return {k: safe(val) for k, val in v.items()}
    return v


def records_from_df(df):
    if df is None or len(df) == 0:
        return []
    return [safe(r) for r in df.to_dict("records")]


def to_code(ticker: str, default_market: str = "US") -> str:
    """Normalise a ticker to a Futu code (e.g. US.AAPL / HK.00700 / CRYPTO.BTCUSD)."""
    t = (ticker or "").strip().upper()
    if not t:
        return t
    if "." in t:  # already qualified
        return t
    if default_market == "CRYPTO":
        # BTC-USD -> US.BTC ; BTC -> US.BTC
        base = t.split("-")[0]
        return f"US.{base}"
    if default_market == "HK":
        return f"HK.{t}"
    if default_market == "SH":
        return f"SH.{t}"
    if default_market == "SZ":
        return f"SZ.{t}"
    return f"US.{t}"


_KTYPE_MAP = {
    "minute": KLType.K_1M,
    "1m": KLType.K_1M,
    "5m": KLType.K_5M,
    "15m": KLType.K_15M,
    "30m": KLType.K_30M,
    "60m": KLType.K_60M,
    "day": KLType.K_DAY,
    "week": KLType.K_WEEK,
    "month": KLType.K_MON,
    "quarter": KLType.K_QUARTER,
    "year": KLType.K_YEAR,
}


def ktype(interval: str, multiplier: int = 1):
    key = (interval or "day").lower()
    if key == "minute":
        m = multiplier or 1
        return {
            1: KLType.K_1M,
            5: KLType.K_5M,
            15: KLType.K_15M,
            30: KLType.K_30M,
            60: KLType.K_60M,
        }.get(m, KLType.K_1M)
    return _KTYPE_MAP.get(key, KLType.K_DAY)


# --- mapping ---------------------------------------------------------------

def map_snapshot(rec: dict) -> dict:
    last = rec.get("last_price")
    prev = rec.get("prev_close_price")
    change = None
    change_pct = None
    if last is not None and prev not in (None, 0):
        change = round(last - prev, 6)
        change_pct = round(change / prev * 100, 4)
    return {
        "ticker": rec.get("code", "").split(".", 1)[-1],
        "name": rec.get("name"),
        "price": last,
        "open": rec.get("open_price"),
        "high": rec.get("high_price"),
        "low": rec.get("low_price"),
        "close": last,
        "prev_close": prev,
        "change": change,
        "change_percent": change_pct,
        "volume": rec.get("volume"),
        "turnover": rec.get("turnover"),
        "timestamp": rec.get("update_time"),
        "pe_ratio": rec.get("pe_ratio"),
        "pe_ttm": rec.get("pe_ttm_ratio"),
        "pb_ratio": rec.get("pb_ratio"),
        "market_cap": rec.get("total_market_val"),
        "fifty_two_week_high": rec.get("highest52weeks_price"),
        "fifty_two_week_low": rec.get("lowest52weeks_price"),
    }


def map_price(rec: dict) -> dict:
    return {
        "ticker": rec.get("code", "").split(".", 1)[-1],
        "date": str(rec.get("time_key"))[:10],
        "open": rec.get("open"),
        "high": rec.get("high"),
        "low": rec.get("low"),
        "close": rec.get("close"),
        "volume": rec.get("volume"),
        "turnover": rec.get("turnover"),
    }


def snapshot_for(ticker: str, market: str) -> dict:
    code = to_code(ticker, market)
    with _lock:
        ret, data = get_ctx().get_market_snapshot([code])
    if ret != RET_OK:
        raise RuntimeError(f"Futu snapshot failed for {code}: {data}")
    recs = records_from_df(data)
    if not recs:
        return {"snapshot": {}}
    return {"snapshot": map_snapshot(recs[0])}


def history_for(ticker: str, market: str, interval: str, start: str, end: str, multiplier: int = 1) -> dict:
    code = to_code(ticker, market)
    kt = ktype(interval, multiplier)
    frames = []
    page_key = None
    with _lock:
        while True:
            ret, data, page_key = get_ctx().request_history_kline(
                code, start=start, end=end, ktype=kt, max_count=1000, page_req_key=page_key
            )
            if ret != RET_OK:
                raise RuntimeError(f"Futu history failed for {code}: {data}")
            frames.append(data)
            if page_key is None or len(data) == 0:
                break
    combined = pd.concat(frames) if frames else data
    recs = [map_price(r) for r in records_from_df(combined)]
    return {"prices": recs}


def ticker_list(market: str) -> dict:
    m = {
        "US": Market.US,
        "HK": Market.HK,
        "SH": Market.SH,
        "SZ": Market.SZ,
    }.get((market or "US").upper(), Market.US)
    with _lock:
        ret, data = get_ctx().get_stock_basicinfo(m, SecurityType.STOCK)
    if ret != RET_OK:
        raise RuntimeError(f"Futu basicinfo failed for {market}: {data}")
    out = []
    for r in records_from_df(data):
        code = r.get("code", "")
        out.append({"ticker": code.split(".", 1)[-1], "name": r.get("name"), "market": code.split(".", 1)[0]})
    return {"tickers": out}


def crypto_ticker_list() -> dict:
    # Futu does not enumerate crypto via basicinfo on all accounts; return a
    # curated set of the most common US-quoted crypto tickers.
    curated = [
        ("BTC-USD", "Bitcoin"),
        ("ETH-USD", "Ethereum"),
        ("SOL-USD", "Solana"),
        ("BNB-USD", "BNB"),
        ("XRP-USD", "XRP"),
        ("DOGE-USD", "Dogecoin"),
        ("ADA-USD", "Cardano"),
        ("AVAX-USD", "Avalanche"),
        ("LINK-USD", "Chainlink"),
        ("MATIC-USD", "Polygon"),
    ]
    return {"tickers": [{"ticker": t, "name": n} for t, n in curated]}


# --- HTTP handler ----------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):  # quiet
        pass

    def _send(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _err(self, msg, status=502):
        self._send({"error": msg}, status)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        q = parse_qs(parsed.query)
        g = lambda k, d=None: (q.get(k, [d])[0] if k in q else d)

        try:
            if path == "/health":
                self._send({"status": "ok", "source": "futu-opend"})
                return

            if path == "/prices/snapshot":
                self._send(snapshot_for(g("ticker", ""), "US"))
                return

            if path == "/prices":
                self._send(history_for(
                    g("ticker", ""), "US",
                    g("interval", "day"),
                    g("start_date", ""), g("end_date", ""),
                ))
                return

            if path == "/prices/snapshot/tickers":
                self._send(ticker_list(g("market", "US")))
                return

            if path == "/crypto/prices/snapshot":
                self._send(snapshot_for(g("ticker", ""), "CRYPTO"))
                return

            if path == "/crypto/prices":
                self._send(history_for(
                    g("ticker", ""), "CRYPTO",
                    g("interval", "day"),
                    g("start_date", ""), g("end_date", ""),
                    int(g("interval_multiplier", 1) or 1),
                ))
                return

            if path == "/crypto/prices/tickers":
                self._send(crypto_ticker_list())
                return

            self._err(f"unknown endpoint: {path}", status=404)
        except Exception as e:  # noqa
            self._err(str(e))


def main():
    server = ThreadingHTTPServer((BRIDGE_HOST, BRIDGE_PORT), Handler)
    print(f"Futu bridge listening on http://{BRIDGE_HOST}:{BRIDGE_PORT} (OpenD {OPEND_HOST}:{OPEND_PORT})")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
