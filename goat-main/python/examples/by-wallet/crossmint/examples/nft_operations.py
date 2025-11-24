import os
from typing import Dict, Any, List
from goat_wallets.crossmint.api_client import CrossmintWalletsAPI

def setup_api_client() -> CrossmintWalletsAPI:
    api_key = os.getenv("CROSSMINT_API_KEY")
    base_url = os.getenv("CROSSMINT_BASE_URL", "https://staging.crossmint.com")
    
    if not api_key:
        raise ValueError("CROSSMINT_API_KEY environment variable is required")
    
    return CrossmintWalletsAPI(api_key=api_key, base_url=base_url)

def get_wallet_nfts(
    api_client: CrossmintWalletsAPI,
    wallet_locator: str
) -> List[Dict[str, Any]]:
    return api_client.get_nfts_from_wallet(wallet_locator)

def main():
    api_client = setup_api_client()
    email = os.getenv("CROSSMINT_USER_EMAIL")
    
    if not email:
        raise ValueError("CROSSMINT_USER_EMAIL environment variable is required")
    
    # Get NFTs from EVM wallet
    evm_wallet_locator = f"email:{email}:evm-smart-wallet"
    evm_nfts = get_wallet_nfts(api_client, evm_wallet_locator)
    print(f"EVM wallet NFTs: {evm_nfts}")
    
    # Get NFTs from Solana wallet
    solana_wallet_locator = f"email:{email}:solana-smart-wallet"
    solana_nfts = get_wallet_nfts(api_client, solana_wallet_locator)
    print(f"Solana wallet NFTs: {solana_nfts}")

if __name__ == "__main__":
    main()
