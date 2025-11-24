"""Unified GOAT Plugin Manager for Dark Dexter."""

from typing import Optional
from goat_wallets.crossmint.solana_smart_wallet import SolanaSmartWalletClient
from goat_adapters.langchain import get_on_chain_tools
from goat_plugins.coingecko import coingecko, CoinGeckoPluginOptions
from goat_plugins.dexscreener import dexscreener, DexScreenerPluginOptions
from goat_plugins.rugcheck import rugcheck, RugcheckPluginOptions
from goat_plugins.nansen import nansen, NansenPluginOptions
from goat_plugins.jupiter import jupiter, JupiterPluginOptions
from goat_plugins.lulo import lulo, LuloPluginOptions


class GOATPluginManager:
    """
    Centralized manager for all GOAT SDK plugins.
    
    Provides easy access to market data, token validation, swaps, and yield.
    """
    
    def __init__(self, wallet: Optional[SolanaSmartWalletClient] = None):
        """
        Initialize GOAT Plugin Manager.
        
        Args:
            wallet: Optional Crossmint wallet for on-chain operations
        """
        self.wallet = wallet
        self._tools = None
    
    def get_all_tools(self, enable_all: bool = True):
        """
        Get all available GOAT tools.
        
        Args:
            enable_all: Whether to enable all plugins (default True)
            
        Returns:
            List of GOAT tools
        """
        if not self.wallet:
            raise ValueError("Wallet required for on-chain tools")
        
        plugins = []
        
        if enable_all:
            plugins = [
                coingecko(CoinGeckoPluginOptions()),
                dexscreener(DexScreenerPluginOptions()),
                rugcheck(RugcheckPluginOptions()),
                nansen(NansenPluginOptions()),
                jupiter(JupiterPluginOptions()),
                lulo(LuloPluginOptions()),
            ]
        
        self._tools = get_on_chain_tools(wallet=self.wallet, plugins=plugins)
        return self._tools
    
    def get_market_data_tools(self):
        """Get tools for market data (CoinGecko, DexScreener)."""
        if not self.wallet:
            raise ValueError("Wallet required for on-chain tools")
        
        plugins = [
            coingecko(CoinGeckoPluginOptions()),
            dexscreener(DexScreenerPluginOptions()),
        ]
        
        return get_on_chain_tools(wallet=self.wallet, plugins=plugins)
    
    def get_security_tools(self):
        """Get tools for token security analysis (Rugcheck, Nansen)."""
        if not self.wallet:
            raise ValueError("Wallet required for on-chain tools")
        
        plugins = [
            rugcheck(RugcheckPluginOptions()),
            nansen(NansenPluginOptions()),
        ]
        
        return get_on_chain_tools(wallet=self.wallet, plugins=plugins)
    
    def get_trading_tools(self):
        """Get tools for trading (Jupiter swaps)."""
        if not self.wallet:
            raise ValueError("Wallet required for on-chain tools")
        
        plugins = [jupiter(JupiterPluginOptions())]
        
        return get_on_chain_tools(wallet=self.wallet, plugins=plugins)
    
    def get_yield_tools(self):
        """Get tools for yield generation (Lulo)."""
        if not self.wallet:
            raise ValueError("Wallet required for on-chain tools")
        
        plugins = [lulo(LuloPluginOptions())]
        
        return get_on_chain_tools(wallet=self.wallet, plugins=plugins)
    
    def list_available_tools(self):
        """List all available tool names."""
        if not self._tools:
            self.get_all_tools()
        
        return [tool.name for tool in self._tools]
    
    def get_tool_by_name(self, name: str):
        """
        Get a specific tool by name.
        
        Args:
            name: Tool name
            
        Returns:
            Tool instance or None
        """
        if not self._tools:
            self.get_all_tools()
        
        return next((tool for tool in self._tools if tool.name == name), None)
