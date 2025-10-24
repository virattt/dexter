from typing_extensions import Callable
from dexter.tools.prices import get_price_snapshot, get_historical_prices, get_ohlc_data
from dexter.tools.market import get_top_cryptocurrencies, get_global_market_data, get_trending_coins
from dexter.tools.info import get_coin_info, search_cryptocurrency

TOOLS: list[Callable[..., any]] = [
    get_price_snapshot,
    get_historical_prices,
    get_ohlc_data,
    get_top_cryptocurrencies,
    get_global_market_data,
    get_trending_coins,
    get_coin_info,
    search_cryptocurrency,
]
