"""BirdEye API client for Solana token data."""

import os
from typing import Optional, List
from datetime import datetime
import requests
from .types import (
    TokenPrice, TokenOverview, TrendingToken, WalletPortfolio, WalletBalance,
    PriceStats, OHLCV, HistoricalPrice, TokenTrade, TokenMarketData, PriceVolumeStats
)


class BirdEyeClient:
    """Client for interacting with BirdEye API."""
    
    BASE_URL = "https://public-api.birdeye.so"
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize BirdEye client.
        
        Args:
            api_key: BirdEye API key. If not provided, will check BIRDEYE_API_KEY env var.
        """
        self.api_key = api_key or os.getenv("BIRDEYE_API_KEY")
        if not self.api_key:
            raise ValueError("BirdEye API key is required. Set BIRDEYE_API_KEY or pass api_key parameter.")
        
        self.headers = {
            "X-API-KEY": self.api_key,
            "Accept": "application/json"
        }
    
    def get_token_price(self, token_address: str) -> TokenPrice:
        """
        Get current price for a single token.
        
        Args:
            token_address: Solana token mint address
            
        Returns:
            TokenPrice object with current price data
        """
        url = f"{self.BASE_URL}/defi/price"
        params = {"address": token_address}
        
        response = requests.get(url, headers=self.headers, params=params)
        response.raise_for_status()
        
        data = response.json()["data"]
        return TokenPrice(
            address=token_address,
            value=data["value"],
            update_unix_time=data["updateUnixTime"],
            update_human_time=data["updateHumanTime"],
            price_change_24h=data.get("priceChange24h")
        )
    
    def get_multiple_prices(self, token_addresses: List[str]) -> List[TokenPrice]:
        """
        Get current prices for multiple tokens.
        
        Args:
            token_addresses: List of Solana token mint addresses
            
        Returns:
            List of TokenPrice objects
        """
        url = f"{self.BASE_URL}/defi/multi_price"
        params = {"list_address": ",".join(token_addresses)}
        
        response = requests.get(url, headers=self.headers, params=params)
        response.raise_for_status()
        
        data = response.json()["data"]
        return [
            TokenPrice(
                address=addr,
                value=price_data["value"],
                update_unix_time=price_data["updateUnixTime"],
                update_human_time=price_data["updateHumanTime"],
                price_change_24h=price_data.get("priceChange24h")
            )
            for addr, price_data in data.items()
        ]
    
    def get_trending_tokens(self, sort_by: str = "rank", sort_type: str = "asc", offset: int = 0, limit: int = 10) -> List[TrendingToken]:
        """
        Get trending Solana tokens.
        
        Args:
            sort_by: Field to sort by (rank, volume_24h_change_percent, etc.)
            sort_type: Sort direction ('asc' or 'desc')
            offset: Pagination offset
            limit: Number of results to return (max 50)
            
        Returns:
            List of TrendingToken objects
        """
        url = f"{self.BASE_URL}/defi/token_trending"
        params = {
            "sort_by": sort_by,
            "sort_type": sort_type,
            "offset": offset,
            "limit": min(limit, 50)
        }
        
        response = requests.get(url, headers=self.headers, params=params)
        response.raise_for_status()
        
        data = response.json()["data"]["tokens"]
        return [
            TrendingToken(
                address=token["address"],
                symbol=token["symbol"],
                name=token["name"],
                decimals=token["decimals"],
                logo_uri=token.get("logoURI"),
                rank=token.get("rank"),
                rank_change=token.get("rankChange"),
                volume_24h_usd=token.get("volume24hUSD"),
                volume_24h_change_percent=token.get("volume24hChangePercent"),
                liquidity=token.get("liquidity"),
                price=token.get("price"),
                price_change_24h_percent=token.get("priceChange24hPercent"),
                price_change_1h_percent=token.get("priceChange1hPercent"),
                mc=token.get("mc"),
                holder=token.get("holder")
            )
            for token in data
        ]
    
    def get_token_overview(self, token_address: str) -> TokenOverview:
        """
        Get overview information for a token.
        
        Args:
            token_address: Solana token mint address
            
        Returns:
            TokenOverview object
        """
        url = f"{self.BASE_URL}/defi/token_overview"
        params = {"address": token_address}
        
        response = requests.get(url, headers=self.headers, params=params)
        response.raise_for_status()
        
        data = response.json()["data"]
        return TokenOverview(
            address=data["address"],
            symbol=data["symbol"],
            name=data["name"],
            decimals=data["decimals"],
            logo_uri=data.get("logoURI"),
            liquidity=data.get("liquidity"),
            price=data.get("price"),
            price_change_24h=data.get("priceChange24h"),
            volume_24h=data.get("volume24h"),
            mc=data.get("mc"),
            holder=data.get("holder"),
            extensions=data.get("extensions")
        )
    
    def get_wallet_portfolio(self, wallet_address: str) -> WalletPortfolio:
        """
        Get wallet portfolio information.
        
        Args:
            wallet_address: Solana wallet address
            
        Returns:
            WalletPortfolio object
        """
        url = f"{self.BASE_URL}/v1/wallet/token_list"
        params = {"wallet": wallet_address}
        
        response = requests.get(url, headers=self.headers, params=params)
        response.raise_for_status()
        
        data = response.json()["data"]
        return WalletPortfolio(
            wallet=wallet_address,
            total_usd=data.get("totalUSD", 0.0),
            items=data.get("items", [])
        )
    
    def get_wallet_balance(self, wallet_address: str) -> List[WalletBalance]:
        """
        Get detailed wallet token balances.
        
        Args:
            wallet_address: Solana wallet address
            
        Returns:
            List of WalletBalance objects
        """
        portfolio = self.get_wallet_portfolio(wallet_address)
        
        balances = []
        for item in portfolio.items:
            balances.append(WalletBalance(
                address=item.get("address", ""),
                balance=item.get("balance", 0),
                decimals=item.get("decimals", 0),
                ui_amount=item.get("uiAmount", 0),
                name=item.get("name"),
                symbol=item.get("symbol"),
                logo_uri=item.get("logoURI"),
                price=item.get("priceUSD"),
                value_usd=item.get("valueUSD")
            ))
        
        return balances
    
    def get_price_stats(self, token_address: str) -> PriceStats:
        """
        Get comprehensive price statistics with multiple timeframes.
        
        Args:
            token_address: Solana token mint address
            
        Returns:
            PriceStats object with price changes across multiple timeframes
        """
        url = f"{self.BASE_URL}/defi/price_volume/single"
        params = {"address": token_address}
        
        response = requests.get(url, headers=self.headers, params=params)
        response.raise_for_status()
        
        data = response.json()["data"]
        return PriceStats(
            address=token_address,
            price=data.get("price", 0.0),
            price_change_1m=data.get("priceChange1mPercent"),
            price_change_5m=data.get("priceChange5mPercent"),
            price_change_30m=data.get("priceChange30mPercent"),
            price_change_1h=data.get("priceChange1hPercent"),
            price_change_2h=data.get("priceChange2hPercent"),
            price_change_4h=data.get("priceChange4hPercent"),
            price_change_8h=data.get("priceChange8hPercent"),
            price_change_24h=data.get("priceChange24hPercent"),
            volume_24h=data.get("volume24h"),
            volume_24h_change=data.get("volume24hChangePercent"),
            liquidity=data.get("liquidity"),
            market_cap=data.get("mc"),
            update_time=data.get("updateTime")
        )
    
    def get_ohlcv_data(
        self,
        token_address: str,
        interval: str = "15m",
        time_from: Optional[int] = None,
        time_to: Optional[int] = None
    ) -> List[OHLCV]:
        """
        Get OHLCV (candlestick) data for a token.
        
        Args:
            token_address: Solana token mint address
            interval: Time interval (1m, 3m, 5m, 15m, 30m, 1H, 2H, 4H, 6H, 8H, 12H, 1D, 3D, 1W, 1M)
            time_from: Start timestamp (Unix seconds)
            time_to: End timestamp (Unix seconds)
            
        Returns:
            List of OHLCV data points
        """
        url = f"{self.BASE_URL}/defi/ohlcv"
        params = {
            "address": token_address,
            "type": interval
        }
        
        if time_from:
            params["time_from"] = str(time_from)
        if time_to:
            params["time_to"] = str(time_to)
        
        response = requests.get(url, headers=self.headers, params=params)
        response.raise_for_status()
        
        data = response.json()["data"]["items"]
        return [
            OHLCV(
                timestamp=item["unixTime"],
                open=item["o"],
                high=item["h"],
                low=item["l"],
                close=item["c"],
                volume=item["v"],
                datetime=datetime.fromtimestamp(item["unixTime"]).isoformat()
            )
            for item in data
        ]
    
    def get_historical_price(
        self,
        token_address: str,
        time_from: Optional[int] = None,
        time_to: Optional[int] = None
    ) -> List[HistoricalPrice]:
        """
        Get historical price data for a token.
        
        Args:
            token_address: Solana token mint address
            time_from: Start timestamp (Unix seconds)
            time_to: End timestamp (Unix seconds)
            
        Returns:
            List of historical price data points
        """
        url = f"{self.BASE_URL}/defi/history_price"
        params = {"address": token_address}
        
        if time_from:
            params["address_type"] = "token"
            params["time_from"] = str(time_from)
        if time_to:
            params["time_to"] = str(time_to)
        
        response = requests.get(url, headers=self.headers, params=params)
        response.raise_for_status()
        
        data = response.json()["data"]["items"]
        return [
            HistoricalPrice(
                timestamp=item["unixTime"],
                price=item["value"],
                datetime=datetime.fromtimestamp(item["unixTime"]).isoformat()
            )
            for item in data
        ]
    
    def get_token_trades(
        self,
        token_address: str,
        offset: int = 0,
        limit: int = 20,
        sort_type: str = "desc"
    ) -> List[TokenTrade]:
        """
        Get recent trades for a token.
        
        Args:
            token_address: Solana token mint address
            offset: Pagination offset
            limit: Number of results (max 100)
            sort_type: Sort by time ('asc' or 'desc')
            
        Returns:
            List of TokenTrade objects
        """
        url = f"{self.BASE_URL}/defi/txs/token"
        params = {
            "address": token_address,
            "offset": offset,
            "limit": min(limit, 100),
            "sort_type": sort_type
        }
        
        response = requests.get(url, headers=self.headers, params=params)
        response.raise_for_status()
        
        data = response.json()["data"]["items"]
        return [
            TokenTrade(
                signature=trade["txHash"],
                block_time=trade["blockUnixTime"],
                side=trade["side"],
                price=trade["price"],
                amount=trade.get("amount", 0.0),
                volume_usd=trade.get("volumeUSD", 0.0),
                source=trade.get("source"),
                wallet=trade.get("owner")
            )
            for trade in data
        ]
    
    def get_token_market_data(self, token_address: str) -> TokenMarketData:
        """
        Get comprehensive market data for a token.
        
        Args:
            token_address: Solana token mint address
            
        Returns:
            TokenMarketData object with comprehensive market statistics
        """
        url = f"{self.BASE_URL}/defi/token_market_data"
        params = {"address": token_address}
        
        response = requests.get(url, headers=self.headers, params=params)
        response.raise_for_status()
        
        data = response.json()["data"]
        return TokenMarketData(
            address=token_address,
            symbol=data.get("symbol", ""),
            name=data.get("name", ""),
            price=data.get("price", 0.0),
            liquidity=data.get("liquidity", 0.0),
            volume_24h=data.get("v24h", 0.0),
            volume_24h_change=data.get("v24hChangePercent"),
            price_change_24h=data.get("priceChange24hPercent"),
            price_change_1h=data.get("priceChange1hPercent"),
            market_cap=data.get("mc"),
            fdv=data.get("fdv"),
            holders=data.get("holder"),
            transactions_24h=data.get("trade24h"),
            buys_24h=data.get("buy24h"),
            sells_24h=data.get("sell24h"),
            buy_volume_24h=data.get("buyVolume24h"),
            sell_volume_24h=data.get("sellVolume24h")
        )
    
    def get_price_volume_stats(self, token_address: str) -> PriceVolumeStats:
        """
        Get price and volume statistics for a token.
        
        Args:
            token_address: Solana token mint address
            
        Returns:
            PriceVolumeStats object
        """
        url = f"{self.BASE_URL}/defi/price_volume/single"
        params = {"address": token_address}
        
        response = requests.get(url, headers=self.headers, params=params)
        response.raise_for_status()
        
        data = response.json()["data"]
        return PriceVolumeStats(
            address=token_address,
            price=data.get("price", 0.0),
            volume_1h=data.get("volume1h"),
            volume_4h=data.get("volume4h"),
            volume_24h=data.get("volume24h"),
            volume_change_1h=data.get("volumeChange1hPercent"),
            volume_change_4h=data.get("volumeChange4hPercent"),
            volume_change_24h=data.get("volumeChange24hPercent"),
            price_high_24h=data.get("priceHigh24h"),
            price_low_24h=data.get("priceLow24h")
        )
    
    def analyze_token_realtime(self, token_address: str) -> dict:
        """
        Perform comprehensive realtime analysis of a token.
        
        This method combines multiple API calls to provide a complete picture:
        - Current price and changes across all timeframes
        - Market data (volume, liquidity, market cap)
        - Recent trades
        - Price statistics
        
        Args:
            token_address: Solana token mint address
            
        Returns:
            Dictionary containing comprehensive token analysis
        """
        # Get all data in parallel
        price_stats = self.get_price_stats(token_address)
        market_data = self.get_token_market_data(token_address)
        recent_trades = self.get_token_trades(token_address, limit=10)
        overview = self.get_token_overview(token_address)
        
        return {
            "token_info": {
                "address": token_address,
                "symbol": overview.symbol,
                "name": overview.name,
                "decimals": overview.decimals,
                "logo": overview.logo_uri
            },
            "price": {
                "current": price_stats.price,
                "changes": {
                    "1m": price_stats.price_change_1m,
                    "5m": price_stats.price_change_5m,
                    "30m": price_stats.price_change_30m,
                    "1h": price_stats.price_change_1h,
                    "2h": price_stats.price_change_2h,
                    "4h": price_stats.price_change_4h,
                    "8h": price_stats.price_change_8h,
                    "24h": price_stats.price_change_24h
                }
            },
            "market": {
                "liquidity": market_data.liquidity,
                "volume_24h": market_data.volume_24h,
                "volume_24h_change": market_data.volume_24h_change,
                "market_cap": market_data.market_cap,
                "fdv": market_data.fdv,
                "holders": market_data.holders
            },
            "trading": {
                "transactions_24h": market_data.transactions_24h,
                "buys_24h": market_data.buys_24h,
                "sells_24h": market_data.sells_24h,
                "buy_volume_24h": market_data.buy_volume_24h,
                "sell_volume_24h": market_data.sell_volume_24h,
                "buy_sell_ratio": (
                    market_data.buys_24h / market_data.sells_24h
                    if market_data.buys_24h and market_data.sells_24h
                    else None
                )
            },
            "recent_trades": [
                {
                    "signature": trade.signature,
                    "side": trade.side,
                    "price": trade.price,
                    "amount": trade.amount,
                    "volume_usd": trade.volume_usd,
                    "time": datetime.fromtimestamp(trade.block_time).isoformat()
                }
                for trade in recent_trades[:5]
            ],
            "update_time": price_stats.update_time
        }
