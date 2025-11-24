"""
This example shows how to create a Solana Smart Wallet and send a transaction to the network 
using a keypair as the admin signer.

To run this example, you need to set the following environment variables:
- CROSSMINT_API_KEY
- SOLANA_RPC_ENDPOINT
- CROSSMINT_BASE_URL
"""

import os
from goat_wallets.crossmint.solana_smart_wallet import SolanaSmartWalletClient
from goat_wallets.crossmint.parameters import CoreSignerType
from goat_wallets.crossmint.solana_smart_wallet_factory import SolanaSmartWalletFactory
from goat_wallets.crossmint.types import SolanaKeypairSigner
from goat_wallets.crossmint.solana_smart_wallet import SolanaSmartWalletConfig
from solana.rpc.api import Client as SolanaClient
from goat_wallets.crossmint.api_client import CrossmintWalletsAPI
from solders.keypair import Keypair
from dotenv import load_dotenv
from solders.pubkey import Pubkey
from solders.instruction import AccountMeta, Instruction


load_dotenv()


def create_memo_instruction(fee_payer: Pubkey, memo: str) -> Instruction:
    memo_program_id = Pubkey.from_string(
        "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr")
    accounts = [AccountMeta(
        pubkey=fee_payer, is_signer=False, is_writable=False)]
    data = bytes(memo, "utf-8")
    return Instruction(
        memo_program_id,
        data,
        accounts,
    )


def create_wallet(factory: SolanaSmartWalletFactory, signer: Keypair) -> SolanaSmartWalletClient:
    print("\n🔑 Creating Solana Smart Wallet with keypair admin signer...")
    wallet = factory.get_or_create({
        "config": SolanaSmartWalletConfig(
            adminSigner=SolanaKeypairSigner(
                type=CoreSignerType.SOLANA_KEYPAIR,
                keyPair=signer
            )
        )
    })
    print(f"✅ Wallet created successfully!")
    print(f"📝 Wallet Address: {wallet.get_address()}")
    print(f"👤 Admin Signer: {signer.pubkey()}")
    return wallet


def send_transaction(wallet: SolanaSmartWalletClient):
    print("\n💸 Preparing transaction...")
    instruction = create_memo_instruction(Pubkey.from_string(
        wallet.get_address()), "My first Solana Smart Wallet transaction! 🚀")
    print(f"📝 Transaction Details:")
    print(f"   From: {wallet.get_address()}")
    print(f"   Message: My first Solana Smart Wallet transaction! 🚀")

    print("\n📤 Sending transaction to network...")
    transaction_response = wallet.send_transaction(
        {
            "instructions": [instruction],
        }
    )
    print(f"✅ Transaction sent successfully!")
    print(f"🔗 Transaction Hash: {transaction_response.get('hash')}")


def main():
    print("🚀 Starting Solana Smart Wallet Keypair Admin Signer Example")
    print("=" * 50)

    api_key = os.getenv("CROSSMINT_API_KEY")
    base_url = os.getenv("CROSSMINT_BASE_URL", "https://staging.crossmint.com")
    rpc_url = os.getenv("SOLANA_RPC_ENDPOINT", "https://api.devnet.solana.com")
    if not api_key:
        raise ValueError("❌ CROSSMINT_API_KEY is required")

    print("\n🔧 Initializing API client and connection...")
    api_client = CrossmintWalletsAPI(api_key, base_url=base_url)
    connection = SolanaClient(rpc_url)

    print("\n🔑 Generating admin keypair...")
    admin_signer = Keypair()

    factory = SolanaSmartWalletFactory(api_client, connection)
    wallet = create_wallet(factory, admin_signer)
    send_transaction(wallet)

    print("\n✨ Example completed successfully!")
    print("=" * 50)


if __name__ == "__main__":
    main()
