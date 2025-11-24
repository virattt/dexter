"""
This file contains examples of how to create a Solana Smart Wallet with different configurations and linked users.

To run these examples, you need to set the following environment variables:
- CROSSMINT_API_KEY
- SOLANA_RPC_ENDPOINT
- CROSSMINT_BASE_URL
"""

from goat_wallets.crossmint.solana_smart_wallet_factory import SolanaSmartWalletFactory
from goat_wallets.crossmint.types import SolanaKeypairSigner, SolanaFireblocksSigner
from goat_wallets.crossmint.solana_smart_wallet import SolanaSmartWalletConfig
from goat_wallets.crossmint.solana_smart_wallet import SolanaSmartWalletClient
from goat_wallets.crossmint.api_client import CrossmintWalletsAPI
from solders.keypair import Keypair
from goat_wallets.crossmint.parameters import CoreSignerType
from typing import Literal, Optional
from solana.rpc.api import Client as SolanaClient
import os
from dotenv import load_dotenv
import uuid

load_dotenv()


def create_wallet(factory: SolanaSmartWalletFactory, signer_type: Literal["solana-keypair", "solana-fireblocks-custodial"], linked_user: Optional[str] = None, idempotency_key: Optional[str] = None) -> SolanaSmartWalletClient:
    print("=" * 50)
    print(
        f"\n🔑 Creating Solana Smart Wallet {"idempotently" if idempotency_key or linked_user else ""} with {signer_type} admin signer and linked user {linked_user}...")
    print(f"Idempotency key: {idempotency_key}") if idempotency_key else None

    config = SolanaSmartWalletConfig(
        adminSigner=SolanaKeypairSigner(
            type=CoreSignerType.SOLANA_KEYPAIR,
            keyPair=Keypair()
        ) if signer_type == "solana-keypair" else SolanaFireblocksSigner(
            type=CoreSignerType.SOLANA_FIREBLOCKS_CUSTODIAL,
        )
    )
    params = {"config": config}
    if linked_user:
        params["linkedUser"] = linked_user
    wallet = factory.get_or_create(params, idempotency_key=idempotency_key)

    print(f"✅ Wallet created successfully!")
    print(f"📝 Wallet Address: {wallet.get_address()}")
    print(
        f"👤 Admin Signer: {wallet.get_admin_signer_address()}. Type: {"MPC Custodial" if signer_type == "solana-fireblocks-custodial" else "Non-custodial"}")
    return wallet


def main():
    print("🚀 Starting Solana Smart Wallet Creation Examples")
    api_key = os.getenv("CROSSMINT_API_KEY")
    base_url = os.getenv("CROSSMINT_BASE_URL", "https://staging.crossmint.com")
    rpc_url = os.getenv("SOLANA_RPC_ENDPOINT", "https://api.devnet.solana.com")
    if not api_key:
        raise ValueError("❌ CROSSMINT_API_KEY is required")

    print("\n🔧 Initializing API client and connection...")
    api_client = CrossmintWalletsAPI(api_key, base_url=base_url)
    connection = SolanaClient(rpc_url)

    print("\n🔧 Initializing factory...")
    factory = SolanaSmartWalletFactory(api_client, connection)

    # Signer configurations
    create_wallet(factory, "solana-keypair")
    create_wallet(factory, "solana-fireblocks-custodial")

    # Idempotency key configurations (both requests will return the same wallet)
    idempotency_key = str(uuid.uuid4())
    create_wallet(factory, "solana-fireblocks-custodial",
                  idempotency_key=idempotency_key)
    create_wallet(factory, "solana-fireblocks-custodial",
                  idempotency_key=idempotency_key)

    # Linked user configurations. Creations with the same linked user will return the same wallet.
    create_wallet(factory, "solana-keypair", "email:example@example.com")
    create_wallet(factory, "solana-fireblocks-custodial",
                  "phoneNumber:+1234567890")
    create_wallet(factory, "solana-keypair", "twitter:example")
    create_wallet(factory, "solana-fireblocks-custodial", "userId:1234567890")
    create_wallet(factory, "solana-keypair", "x:example")


if __name__ == "__main__":
    main()
