"""Crossmint Smart Wallet Manager for Dexter."""

import os
import json
from pathlib import Path
from typing import Optional, Dict, Any
from solders.keypair import Keypair
from solana.rpc.api import Client as SolanaClient
from goat_wallets.crossmint.api_client import CrossmintWalletsAPI
from goat_wallets.crossmint.solana_smart_wallet_factory import SolanaSmartWalletFactory
from goat_wallets.crossmint.solana_smart_wallet import SolanaSmartWalletClient, SolanaSmartWalletConfig
from goat_wallets.crossmint.types import SolanaKeypairSigner, SolanaFireblocksSigner
from goat_wallets.crossmint.parameters import CoreSignerType


class CrossmintWalletManager:
    """Manages Crossmint Smart Wallet creation and operations."""
    
    WALLET_CONFIG_FILE = Path.home() / ".dexter" / "crossmint_wallet.json"
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        rpc_endpoint: Optional[str] = None
    ):
        """
        Initialize Crossmint Wallet Manager.
        
        Args:
            api_key: Crossmint API key (defaults to CROSSMINT_API_KEY env var)
            base_url: Crossmint base URL (defaults to CROSSMINT_BASE_URL env var)
            rpc_endpoint: Solana RPC endpoint (defaults to SOLANA_RPC_ENDPOINT env var)
        """
        self.api_key = api_key or os.getenv("CROSSMINT_API_KEY")
        self.base_url = base_url or os.getenv("CROSSMINT_BASE_URL", "https://staging.crossmint.com")
        self.rpc_endpoint = rpc_endpoint or os.getenv("SOLANA_RPC_ENDPOINT", "https://api.devnet.solana.com")
        
        if not self.api_key:
            raise ValueError("CROSSMINT_API_KEY is required")
        
        # Initialize API client and connection
        self.api_client = CrossmintWalletsAPI(self.api_key, base_url=self.base_url)
        self.connection = SolanaClient(self.rpc_endpoint)
        self.factory = SolanaSmartWalletFactory(self.api_client, self.connection)
        
        # Ensure config directory exists
        self.WALLET_CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    
    def create_keypair_wallet(
        self,
        linked_user: Optional[str] = None,
        save_config: bool = True
    ) -> SolanaSmartWalletClient:
        """
        Create a Solana Smart Wallet with keypair admin signer.
        
        Args:
            linked_user: Optional linked user identifier (e.g., "email:user@example.com")
            save_config: Whether to save wallet configuration
            
        Returns:
            SolanaSmartWalletClient instance
        """
        print("\n🔑 Creating Solana Smart Wallet with keypair admin signer...")
        
        # Generate admin keypair
        admin_keypair = Keypair()
        
        # Create wallet config
        config = SolanaSmartWalletConfig(
            adminSigner=SolanaKeypairSigner(
                type=CoreSignerType.SOLANA_KEYPAIR,
                keyPair=admin_keypair
            )
        )
        
        params: Dict[str, Any] = {"config": config}
        if linked_user:
            params["linkedUser"] = linked_user
        
        # Create wallet
        wallet = self.factory.get_or_create(params)
        
        print(f"✅ Wallet created successfully!")
        print(f"📝 Wallet Address: {wallet.get_address()}")
        print(f"👤 Admin Signer: {admin_keypair.pubkey()}")
        
        if save_config:
            self._save_wallet_config({
                "wallet_address": wallet.get_address(),
                "admin_signer": str(admin_keypair.pubkey()),
                "admin_keypair": list(bytes(admin_keypair)),
                "signer_type": "keypair",
                "linked_user": linked_user
            })
        
        return wallet
    
    def create_fireblocks_wallet(
        self,
        linked_user: str,
        save_config: bool = True
    ) -> SolanaSmartWalletClient:
        """
        Create a Solana Smart Wallet with Fireblocks custodial signer.
        
        Args:
            linked_user: Linked user identifier (e.g., "email:user@example.com")
            save_config: Whether to save wallet configuration
            
        Returns:
            SolanaSmartWalletClient instance
        """
        print("\n🔑 Creating Solana Smart Wallet with Fireblocks custodial signer...")
        
        config = SolanaSmartWalletConfig(
            adminSigner=SolanaFireblocksSigner(
                type=CoreSignerType.SOLANA_FIREBLOCKS_CUSTODIAL
            )
        )
        
        params: Dict[str, Any] = {
            "config": config,
            "linkedUser": linked_user
        }
        
        # Create wallet
        wallet = self.factory.get_or_create(params)
        
        print(f"✅ Wallet created successfully!")
        print(f"📝 Wallet Address: {wallet.get_address()}")
        print(f"👤 Admin Signer: {wallet.get_admin_signer_address()} (MPC Custodial)")
        
        if save_config:
            self._save_wallet_config({
                "wallet_address": wallet.get_address(),
                "admin_signer": wallet.get_admin_signer_address(),
                "signer_type": "fireblocks",
                "linked_user": linked_user
            })
        
        return wallet
    
    def load_wallet_from_config(self) -> Optional[SolanaSmartWalletClient]:
        """
        Load wallet from saved configuration.
        
        Returns:
            SolanaSmartWalletClient instance if config exists, None otherwise
        """
        if not self.WALLET_CONFIG_FILE.exists():
            return None
        
        with open(self.WALLET_CONFIG_FILE, 'r') as f:
            config = json.load(f)
        
        print(f"\n🔓 Loading existing Crossmint wallet from config...")
        print(f"📝 Wallet Address: {config['wallet_address']}")
        print(f"👤 Admin Signer: {config['admin_signer']}")
        
        # Recreate wallet based on signer type
        if config['signer_type'] == 'keypair':
            admin_keypair = Keypair.from_bytes(bytes(config['admin_keypair']))
            wallet_config = SolanaSmartWalletConfig(
                adminSigner=SolanaKeypairSigner(
                    type=CoreSignerType.SOLANA_KEYPAIR,
                    keyPair=admin_keypair
                )
            )
        else:  # fireblocks
            wallet_config = SolanaSmartWalletConfig(
                adminSigner=SolanaFireblocksSigner(
                    type=CoreSignerType.SOLANA_FIREBLOCKS_CUSTODIAL
                )
            )
        
        params: Dict[str, Any] = {"config": wallet_config}
        if config.get('linked_user'):
            params["linkedUser"] = config['linked_user']
        
        return self.factory.get_or_create(params)
    
    def get_or_create_wallet(
        self,
        signer_type: str = "keypair",
        linked_user: Optional[str] = None
    ) -> SolanaSmartWalletClient:
        """
        Get existing wallet or create new one.
        
        Args:
            signer_type: Type of signer ("keypair" or "fireblocks")
            linked_user: Optional linked user identifier
            
        Returns:
            SolanaSmartWalletClient instance
        """
        # Try to load existing wallet
        wallet = self.load_wallet_from_config()
        if wallet:
            return wallet
        
        # Create new wallet
        if signer_type == "fireblocks":
            if not linked_user:
                raise ValueError("linked_user is required for Fireblocks wallets")
            return self.create_fireblocks_wallet(linked_user)
        else:
            return self.create_keypair_wallet(linked_user)
    
    def get_wallet_balance(self, wallet: SolanaSmartWalletClient, tokens: list[str] = None) -> list[Dict]:
        """
        Get wallet balance for specified tokens.
        
        Args:
            wallet: SolanaSmartWalletClient instance
            tokens: List of token symbols (defaults to ["sol", "usdc"])
            
        Returns:
            List of balance information
        """
        if tokens is None:
            tokens = ["sol", "usdc"]
        
        return wallet.balance_of(tokens)
    
    def _save_wallet_config(self, config: Dict[str, Any]) -> None:
        """Save wallet configuration to file."""
        with open(self.WALLET_CONFIG_FILE, 'w') as f:
            json.dump(config, f, indent=2)
        print(f"💾 Wallet configuration saved to: {self.WALLET_CONFIG_FILE}")
