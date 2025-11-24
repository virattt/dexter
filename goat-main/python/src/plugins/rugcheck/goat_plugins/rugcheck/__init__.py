from dataclasses import dataclass

from goat.classes.plugin_base import PluginBase
from .service import RugCheckService


@dataclass
class RugCheckPluginOptions:
    jwt_token: str = ""
    base_url: str = "https://api.rugcheck.xyz/v1"


class RugCheckPlugin(PluginBase):
    def __init__(self, options: RugCheckPluginOptions):
        super().__init__("rugcheck", [RugCheckService(options.jwt_token, options.base_url)])

    def supports_chain(self, chain) -> bool:
        return True


def rugcheck(options: RugCheckPluginOptions) -> RugCheckPlugin:
    return RugCheckPlugin(options)
