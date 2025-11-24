from dataclasses import dataclass
from goat.classes.plugin_base import PluginBase
from .service import JupiterService


@dataclass
class JupiterPluginOptions:
    """Options for the JupiterPlugin."""
    pass  # No options needed for Jupiter v6


class JupiterPlugin(PluginBase):
    def __init__(self, options: JupiterPluginOptions):
        super().__init__("jupiter", [JupiterService()])

    def supports_chain(self, chain) -> bool:
        return chain['type'] == 'solana'


def jupiter(options: JupiterPluginOptions) -> JupiterPlugin:
    return JupiterPlugin(options)
