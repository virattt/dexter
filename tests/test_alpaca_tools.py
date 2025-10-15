import sys
from pathlib import Path

import pytest
import requests


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from dexter import tools as alpaca_tools  # noqa: E402


class StubResponse:
    def __init__(self, *, status_code: int = 200, json_data=None):
        self.status_code = status_code
        self._json_data = json_data if json_data is not None else {}
        self.kwargs = {}

    def json(self):
        return self._json_data

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"HTTP {self.status_code}")


@pytest.fixture(autouse=True)
def reset_credentials(monkeypatch):
    monkeypatch.setattr(alpaca_tools, "alpaca_api_key", "key")
    monkeypatch.setattr(alpaca_tools, "alpaca_api_secret", "secret")
    monkeypatch.setattr(alpaca_tools, "alpaca_base_url", "https://paper-api.alpaca.markets")


def test_alpaca_headers_missing_credentials(monkeypatch):
    monkeypatch.setattr(alpaca_tools, "alpaca_api_key", None)
    monkeypatch.setattr(alpaca_tools, "alpaca_api_secret", None)
    with pytest.raises(ValueError):
        alpaca_tools._alpaca_headers()


def test_place_alpaca_order_submits_payload(monkeypatch):
    captured = {}

    def fake_post(url, json=None, headers=None):
        captured["url"] = url
        captured["json"] = json
        captured["headers"] = headers
        return StubResponse(json_data={"id": "order-123"})

    monkeypatch.setattr(alpaca_tools.requests, "post", fake_post)

    result = alpaca_tools.place_alpaca_order.func(
        symbol="aapl",
        qty=10,
        side="buy",
        order_type="market",
        time_in_force="day",
    )

    assert result == {"id": "order-123"}
    assert captured["url"] == "https://paper-api.alpaca.markets/v2/orders"
    assert captured["json"]["symbol"] == "AAPL"
    assert captured["json"]["qty"] == 10
    assert captured["headers"]["APCA-API-KEY-ID"] == "key"


def test_place_alpaca_order_requires_limit_price(monkeypatch):
    with pytest.raises(ValueError):
        alpaca_tools.place_alpaca_order.func(
            symbol="AAPL",
            qty=1,
            side="buy",
            order_type="limit",
            time_in_force="day",
        )


def test_get_alpaca_positions_all(monkeypatch):
    expected = [{"symbol": "AAPL"}]

    def fake_get(url, headers=None):
        assert url == "https://paper-api.alpaca.markets/v2/positions"
        return StubResponse(json_data=expected)

    monkeypatch.setattr(alpaca_tools.requests, "get", fake_get)
    result = alpaca_tools.get_alpaca_positions.func()
    assert result == expected


def test_get_alpaca_positions_single_returns_list(monkeypatch):
    def fake_get(url, headers=None):
        assert url == "https://paper-api.alpaca.markets/v2/positions/AAPL"
        return StubResponse(json_data={"symbol": "AAPL"})

    monkeypatch.setattr(alpaca_tools.requests, "get", fake_get)
    result = alpaca_tools.get_alpaca_positions.func(symbol="AAPL")
    assert result == [{"symbol": "AAPL"}]


def test_get_alpaca_positions_404_returns_empty(monkeypatch):
    def fake_get(url, headers=None):
        return StubResponse(status_code=404)

    monkeypatch.setattr(alpaca_tools.requests, "get", fake_get)
    assert alpaca_tools.get_alpaca_positions.func(symbol="MSFT") == []


def test_get_alpaca_orders_builds_params(monkeypatch):
    captured = {}

    def fake_get(url, params=None, headers=None):
        captured["url"] = url
        captured["params"] = params
        return StubResponse(json_data=[{"id": "ord"}])

    monkeypatch.setattr(alpaca_tools.requests, "get", fake_get)

    result = alpaca_tools.get_alpaca_orders.func(
        status="open",
        limit=25,
        direction="asc",
        symbols=["aapl", "tsla"],
        nested=True,
    )

    assert result == [{"id": "ord"}]
    assert captured["url"] == "https://paper-api.alpaca.markets/v2/orders"
    assert captured["params"]["status"] == "open"
    assert captured["params"]["symbols"] == "AAPL,TSLA"
    assert captured["params"]["nested"] == "true"


def test_get_alpaca_account_returns_response(monkeypatch):
    def fake_get(url, headers=None):
        assert url == "https://paper-api.alpaca.markets/v2/account"
        return StubResponse(json_data={"account_number": "ABC123"})

    monkeypatch.setattr(alpaca_tools.requests, "get", fake_get)
    assert alpaca_tools.get_alpaca_account.func() == {"account_number": "ABC123"}


def test_get_alpaca_assets_all(monkeypatch):
    def fake_get(url, headers=None, params=None):
        assert url == "https://paper-api.alpaca.markets/v2/assets"
        assert params == {"status": "active"}
        return StubResponse(json_data=[{"symbol": "AAPL", "tradable": True}])

    monkeypatch.setattr(alpaca_tools.requests, "get", fake_get)
    result = alpaca_tools.get_alpaca_assets.func(status="active")
    assert result == [{"symbol": "AAPL", "tradable": True}]


def test_get_alpaca_assets_single(monkeypatch):
    def fake_get(url, headers=None, params=None):
        assert url == "https://paper-api.alpaca.markets/v2/assets/AAPL"
        return StubResponse(json_data={"symbol": "AAPL", "tradable": True})

    monkeypatch.setattr(alpaca_tools.requests, "get", fake_get)
    result = alpaca_tools.get_alpaca_assets.func(symbol="AAPL")
    assert result == [{"symbol": "AAPL", "tradable": True}]


def test_get_alpaca_clock(monkeypatch):
    def fake_get(url, headers=None):
        assert url == "https://paper-api.alpaca.markets/v2/clock"
        return StubResponse(json_data={"is_open": True, "timestamp": "2023-01-01T12:00:00Z"})

    monkeypatch.setattr(alpaca_tools.requests, "get", fake_get)
    result = alpaca_tools.get_alpaca_clock.func()
    assert result == {"is_open": True, "timestamp": "2023-01-01T12:00:00Z"}


def test_get_alpaca_calendar(monkeypatch):
    def fake_get(url, headers=None, params=None):
        assert url == "https://paper-api.alpaca.markets/v2/calendar"
        assert params == {"start": "2023-01-01"}
        return StubResponse(json_data=[{"date": "2023-01-01", "open": "09:30", "close": "16:00"}])

    monkeypatch.setattr(alpaca_tools.requests, "get", fake_get)
    result = alpaca_tools.get_alpaca_calendar.func(start="2023-01-01")
    assert result == [{"date": "2023-01-01", "open": "09:30", "close": "16:00"}]


def test_get_alpaca_watchlists(monkeypatch):
    def fake_get(url, headers=None):
        assert url == "https://paper-api.alpaca.markets/v2/watchlists"
        return StubResponse(json_data=[{"id": "123", "name": "Tech Stocks"}])

    monkeypatch.setattr(alpaca_tools.requests, "get", fake_get)
    result = alpaca_tools.get_alpaca_watchlists.func()
    assert result == [{"id": "123", "name": "Tech Stocks"}]


def test_create_alpaca_watchlist(monkeypatch):
    def fake_post(url, json=None, headers=None):
        assert url == "https://paper-api.alpaca.markets/v2/watchlists"
        assert json == {"name": "My Watchlist", "symbols": ["AAPL", "TSLA"]}
        return StubResponse(json_data={"id": "456", "name": "My Watchlist"})

    monkeypatch.setattr(alpaca_tools.requests, "post", fake_post)
    result = alpaca_tools.create_alpaca_watchlist.func("My Watchlist", ["AAPL", "TSLA"])
    assert result == {"id": "456", "name": "My Watchlist"}


def test_get_alpaca_account_activities(monkeypatch):
    def fake_get(url, headers=None, params=None):
        assert url == "https://paper-api.alpaca.markets/v2/account/activities"
        assert params == {"activity_types": "FILL,DIV"}
        return StubResponse(json_data=[{"activity_type": "FILL", "symbol": "AAPL"}])

    monkeypatch.setattr(alpaca_tools.requests, "get", fake_get)
    result = alpaca_tools.get_alpaca_account_activities.func(activity_types=["FILL", "DIV"])
    assert result == [{"activity_type": "FILL", "symbol": "AAPL"}]


def test_get_alpaca_portfolio_history(monkeypatch):
    def fake_get(url, headers=None, params=None):
        assert url == "https://paper-api.alpaca.markets/v2/account/portfolio/history"
        assert params == {"period": "1M"}
        return StubResponse(json_data={"timestamp": [1234567890], "equity": [10000.0]})

    monkeypatch.setattr(alpaca_tools.requests, "get", fake_get)
    result = alpaca_tools.get_alpaca_portfolio_history.func(period="1M")
    assert result == {"timestamp": [1234567890], "equity": [10000.0]}
