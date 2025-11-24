"""Type definitions for BirdEye API responses."""

from dataclasses import dataclass
from typing import Optional


@dataclass
class TokenPrice:
    """Token price information."""
    
    address: str
    value: float
    update_unix_time: int
    update_human_time: str
    price_change_24h: Optional[float] = None


@dataclass
class TokenOverview:
    """Token overview information."""
    
    address: str
    symbol: str
    name: str
    decimals: int
    logo_uri: Optional[str] = None
    liquidity: Optional[float] = None
    price: Optional[float] = None
    price_change_24h: Optional[float] = None
    volume_24h: Optional[float] = None
    mc: Optional[float] = None  # Market cap
    holder: Optional[int] = None
    extensions: Optional[dict] = None


@dataclass
class TrendingToken:
    """Trending token information."""
    
    address: str
    symbol: str
    name: str
    decimals: int
    logo_uri: Optional[str] = None
    rank: Optional[int] = None
    rank_change: Optional[int] = None
    volume_24h_usd: Optional[float] = None
    volume_24h_change_percent: Optional[float] = None
    liquidity: Optional[float] = None
    price: Optional[float] = None
    price_change_24h_percent: Optional[float] = None
    price_change_1h_percent: Optional[float] = None
    mc: Optional[float] = None
    holder: Optional[int] = None


@dataclass
class WalletPortfolio:
    """Wallet portfolio information."""
    
    wallet: str
    total_usd: float
    items: list[dict]


@dataclass
class WalletBalance:
    """Wallet token balance."""
    
    address: str
    balance: float
    decimals: int
    ui_amount: float
    name: Optional[str] = None
    symbol: Optional[str] = None
    logo_uri: Optional[str] = None
    price: Optional[float] = None
    value_usd: Optional[float] = None


@dataclass
class PriceStats:
    """Comprehensive price statistics with multiple timeframes."""
    
    address: str
    price: float
    price_change_1m: Optional[float] = None
    price_change_5m: Optional[float] = None
    price_change_30m: Optional[float] = None
    price_change_1h: Optional[float] = None
    price_change_2h: Optional[float] = None
    price_change_4h: Optional[float] = None
    price_change_8h: Optional[float] = None
    price_change_24h: Optional[float] = None
    volume_24h: Optional[float] = None
    volume_24h_change: Optional[float] = None
    liquidity: Optional[float] = None
    market_cap: Optional[float] = None
    update_time: Optional[str] = None


@dataclass
class OHLCV:
    """OHLCV (candlestick) data point."""
    
    timestamp: int
    open: float
    high: float
    low: float
    close: float
    volume: float
    datetime: Optional[str] = None


@dataclass
class HistoricalPrice:
    """Historical price data point."""
    
    timestamp: int
    price: float
    datetime: Optional[str] = None


@dataclass
class TokenTrade:
    """Token trade transaction data."""
    
    signature: str
    block_time: int
    side: str  # 'buy' or 'sell'
    price: float
    amount: float
    volume_usd: float
    source: Optional[str] = None
    wallet: Optional[str] = None


@dataclass
class TokenMarketData:
    """Comprehensive token market data."""
    
    address: str
    symbol: str
    name: str
    price: float
    liquidity: float
    volume_24h: float
    volume_24h_change: Optional[float] = None
    price_change_24h: Optional[float] = None
    price_change_1h: Optional[float] = None
    market_cap: Optional[float] = None
    fdv: Optional[float] = None  # Fully diluted valuation
    holders: Optional[int] = None
    transactions_24h: Optional[int] = None
    buys_24h: Optional[int] = None
    sells_24h: Optional[int] = None
    buy_volume_24h: Optional[float] = None
    sell_volume_24h: Optional[float] = None


@dataclass
class PriceVolumeStats:
    """Price and volume statistics."""
    
    address: str
    price: float
    volume_1h: Optional[float] = None
    volume_4h: Optional[float] = None
    volume_24h: Optional[float] = None
    volume_change_1h: Optional[float] = None
    volume_change_4h: Optional[float] = None
    volume_change_24h: Optional[float] = None
    price_high_24h: Optional[float] = None
    price_low_24h: Optional[float] = None
