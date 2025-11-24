from dataclasses import dataclass
from goat.classes.plugin_base import PluginBase
from .service import NansenService


@dataclass
class NansenPluginOptions:
    api_key: str


class NansenPlugin(PluginBase):
    def __init__(self, options: NansenPluginOptions):
        super().__init__("nansen", [NansenService(options.api_key)])

    def supports_chain(self, chain) -> bool:
        return True


def nansen(options: NansenPluginOptions) -> NansenPlugin:
    return NansenPlugin(options)
