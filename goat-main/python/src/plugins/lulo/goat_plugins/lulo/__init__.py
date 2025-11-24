from dataclasses import dataclass
from goat.classes.plugin_base import PluginBase
from .service import LuloService


@dataclass
class LuloPluginOptions:
    """Options for the LuloPlugin."""
    pass  # No options needed for Lulo


class LuloPlugin(PluginBase):
    def __init__(self, options: LuloPluginOptions):
        super().__init__("lulo", [LuloService()])

    def supports_chain(self, chain) -> bool:
        return chain['type'] == 'solana'


def lulo(options: LuloPluginOptions) -> LuloPlugin:
    return LuloPlugin(options)
