from dataclasses import dataclass

from goat.classes.plugin_base import PluginBase
from .service import CoinGeckoService


@dataclass
class CoinGeckoPluginOptions:
    api_key: str


class CoinGeckoPlugin(PluginBase):
    def __init__(self, options: CoinGeckoPluginOptions):
        super().__init__("coingecko", [CoinGeckoService(options.api_key)])

    def supports_chain(self, chain) -> bool:
        return True


def coingecko(options: CoinGeckoPluginOptions) -> CoinGeckoPlugin:
    return CoinGeckoPlugin(options)
