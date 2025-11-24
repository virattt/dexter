from dataclasses import dataclass
from goat.classes.plugin_base import PluginBase
from .service import DexscreenerService


@dataclass
class DexscreenerPluginOptions:
    # Dexscreener currently doesn't require any auth keys
    pass


class DexscreenerPlugin(PluginBase):
    def __init__(self, options: DexscreenerPluginOptions):
        super().__init__("dexscreener", [DexscreenerService()])

    def supports_chain(self, chain) -> bool:
        # Dexscreener is a data provider for multiple chains
        return True


def dexscreener(options: DexscreenerPluginOptions) -> DexscreenerPlugin:
    return DexscreenerPlugin(options)
