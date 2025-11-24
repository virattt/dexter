from dataclasses import dataclass
from goat.classes.plugin_base import PluginBase
from .service import CrossmintHeadlessCheckoutService


@dataclass
class CrossmintHeadlessCheckoutPluginOptions:
    """Options for the CrossmintHeadlessCheckoutPlugin."""
    api_key: str  # API key for external service integration


class CrossmintHeadlessCheckoutPlugin(PluginBase):
    """
    Plugin for Crossmint's Headless Checkout API.
    
    This plugin allows purchasing of various items (NFTs, physical products, etc.)
    through Crossmint's APIs using cryptocurrency.
    """
    def __init__(self, options: CrossmintHeadlessCheckoutPluginOptions):
        super().__init__("crossmint-headless-checkout", [CrossmintHeadlessCheckoutService(options.api_key)])

    def supports_chain(self, chain) -> bool:
        """
        This plugin supports all chains, since Crossmint can facilitate transactions on various chains.
        
        Args:
            chain: The chain to check support for
            
        Returns:
            bool: Always True, as Crossmint supports multiple chains
        """
        # Support all chains, just like in the TypeScript implementation
        return True


def crossmint_headless_checkout(options: CrossmintHeadlessCheckoutPluginOptions) -> CrossmintHeadlessCheckoutPlugin:
    """
    Create a new instance of the CrossmintHeadlessCheckoutPlugin.
    
    Args:
        options: Configuration options for the plugin
        
    Returns:
        An instance of CrossmintHeadlessCheckoutPlugin
    """
    return CrossmintHeadlessCheckoutPlugin(options)
