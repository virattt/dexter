import os
from typing import Dict, Any
from solana.rpc.api import Client as SolanaClient
from goat_wallets.crossmint.api_client import CrossmintWalletsAPI
from goat_wallets.crossmint.parameters import WalletType
from goat_wallets.crossmint.evm_smart_wallet import smart_wallet_factory as evm_smart_wallet_factory
from goat_wallets.crossmint.solana_smart_wallet_factory import solana_smart_wallet_factory

def setup_api_client() -> CrossmintWalletsAPI:
    api_key = os.getenv("CROSSMINT_API_KEY")
    base_url = os.getenv("CROSSMINT_BASE_URL", "https://staging.crossmint.com")
    
    if not api_key:
        raise ValueError("CROSSMINT_API_KEY environment variable is required")
    
    return CrossmintWalletsAPI(api_key=api_key, base_url=base_url)

def create_evm_smart_wallet(api_client: CrossmintWalletsAPI, email: str) -> Dict[str, Any]:
    factory = evm_smart_wallet_factory(api_client)
    wallet = factory({"email": email})
    return {
        "address": wallet.get_address(),
        "type": "EVM Smart Wallet"
    }

def create_solana_smart_wallet(api_client: CrossmintWalletsAPI, email: str) -> Dict[str, Any]:
    rpc_url = os.getenv("SOLANA_RPC_ENDPOINT", "https://api.devnet.solana.com")
    connection = SolanaClient(rpc_url)
    
    factory = solana_smart_wallet_factory(api_client)
    wallet = factory({
        "email": email,
        "connection": connection
    })
    return {
        "address": wallet.get_address(),
        "type": "Solana Smart Wallet"
    }

def get_wallet_balance(api_client: CrossmintWalletsAPI, wallet_locator: str) -> Dict[str, Any]:
    wallet = api_client.get_wallet(wallet_locator)
    balance = api_client.get_wallet_balance(wallet_locator)
    return {
        "address": wallet["address"],
        "balance": balance
    }

def fund_wallet(api_client: CrossmintWalletsAPI, wallet_locator: str, amount: str, token: str) -> Dict[str, Any]:
    response = api_client.fund_wallet(wallet_locator, amount, token)
    return response

def main():
    api_client = setup_api_client()
    email = os.getenv("CROSSMINT_USER_EMAIL")
    
    if not email:
        raise ValueError("CROSSMINT_USER_EMAIL environment variable is required")
    
    # Create wallets
    evm_wallet = create_evm_smart_wallet(api_client, email)
    print(f"Created EVM wallet: {evm_wallet}")
    
    solana_wallet = create_solana_smart_wallet(api_client, email)
    print(f"Created Solana wallet: {solana_wallet}")
    
    # Get balances
    evm_balance = get_wallet_balance(api_client, f"email:{email}:evm-smart-wallet")
    print(f"EVM wallet balance: {evm_balance}")
    
    solana_balance = get_wallet_balance(api_client, f"email:{email}:solana-smart-wallet")
    print(f"Solana wallet balance: {solana_balance}")
    
    # Fund wallets (on testnet)
    evm_funding = fund_wallet(api_client, f"email:{email}:evm-smart-wallet", "0.1", "ETH")
    print(f"Funded EVM wallet: {evm_funding}")
    
    solana_funding = fund_wallet(api_client, f"email:{email}:solana-smart-wallet", "1", "SOL")
    print(f"Funded Solana wallet: {solana_funding}")

if __name__ == "__main__":
    main()
