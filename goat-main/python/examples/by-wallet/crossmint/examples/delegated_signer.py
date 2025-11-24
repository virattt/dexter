import os
from typing import Dict, Any, List, Optional, Union
from goat_wallets.crossmint.api_client import CrossmintWalletsAPI
from goat_wallets.crossmint.parameters import DelegatedSignerPermission

def setup_api_client() -> CrossmintWalletsAPI:
    api_key = os.getenv("CROSSMINT_API_KEY")
    base_url = os.getenv("CROSSMINT_BASE_URL", "https://staging.crossmint.com")
    
    if not api_key:
        raise ValueError("CROSSMINT_API_KEY environment variable is required")
    
    return CrossmintWalletsAPI(api_key=api_key, base_url=base_url)

def register_delegated_signer(
    api_client: CrossmintWalletsAPI,
    wallet_locator: str,
    signer: Union[str, Dict[str, str]],
    chain: str,
    expires_at: Optional[int] = None,
    permissions: Optional[List[DelegatedSignerPermission]] = None # Only for EVM
) -> Dict[str, Any]:
    return api_client.register_delegated_signer(
        wallet_locator,
        signer,
        chain,
        expires_at,
        permissions
    )

def get_delegated_signer(
    api_client: CrossmintWalletsAPI,
    wallet_locator: str,
    signer_locator: Union[str, Dict[str, str]]
) -> Dict[str, Any]:
    if isinstance(signer_locator, dict):
        signer_locator = signer_locator.get("email", "")
    return api_client.get_delegated_signer(wallet_locator, signer_locator)

def main():
    api_client = setup_api_client()
    email = os.getenv("CROSSMINT_USER_EMAIL")
    delegated_email = os.getenv("CROSSMINT_DELEGATED_EMAIL")
    
    if not all([email, delegated_email]):
        raise ValueError("CROSSMINT_USER_EMAIL and CROSSMINT_DELEGATED_EMAIL are required")
    
    # Ensure email values are strings
    email_str = str(email)
    delegated_email_str = str(delegated_email)
    
    # EVM delegated signer example
    evm_wallet_locator = f"email:{email_str}:evm-smart-wallet"
    evm_permissions = [
        DelegatedSignerPermission(type="transaction", value="*"),
        DelegatedSignerPermission(type="signature", value="*")
    ]
    
    evm_signer = register_delegated_signer(
        api_client,
        evm_wallet_locator,
        {"email": delegated_email_str},
        "evm",
        permissions=evm_permissions
    )
    print(f"Registered EVM delegated signer: {evm_signer}")
    
    evm_signer_info = get_delegated_signer(api_client, evm_wallet_locator, {"email": delegated_email_str})
    print(f"EVM delegated signer info: {evm_signer_info}")
    
    # Solana delegated signer example
    solana_wallet_locator = f"email:{email_str}:solana-smart-wallet"
    
    solana_signer = register_delegated_signer(
        api_client,
        solana_wallet_locator,
        {"email": delegated_email_str},
        "solana",
    )
    print(f"Registered Solana delegated signer: {solana_signer}")
    
    solana_signer_info = get_delegated_signer(api_client, solana_wallet_locator, {"email": delegated_email_str})
    print(f"Solana delegated signer info: {solana_signer_info}")

if __name__ == "__main__":
    main()
