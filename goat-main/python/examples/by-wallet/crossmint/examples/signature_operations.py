import os
import time
from typing import Dict, Any, List, Optional
from goat_wallets.crossmint.api_client import CrossmintWalletsAPI

def setup_api_client() -> CrossmintWalletsAPI:
    api_key = os.getenv("CROSSMINT_API_KEY")
    base_url = os.getenv("CROSSMINT_BASE_URL", "https://staging.crossmint.com")
    
    if not api_key:
        raise ValueError("CROSSMINT_API_KEY environment variable is required")
    
    return CrossmintWalletsAPI(api_key=api_key, base_url=base_url)

def create_signature(
    api_client: CrossmintWalletsAPI,
    wallet_locator: str,
    message: str,
    chain: str,
    signer: Optional[str] = None,
    required_signers: Optional[List[str]] = None
) -> Dict[str, Any]:
    response = api_client.sign_message_for_smart_wallet(
        wallet_locator,
        message,
        chain,
        signer=signer,
        required_signers=required_signers
    )
    return response

def get_signature_status(
    api_client: CrossmintWalletsAPI,
    signature_id: str,
    wallet_locator: str
) -> Dict[str, Any]:
    return api_client.check_signature_status(signature_id, wallet_locator)

def approve_signature(
    api_client: CrossmintWalletsAPI,
    signature_id: str,
    wallet_locator: str,
    signer: Optional[str] = None,
    approvals: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    return api_client.approve_signature_for_smart_wallet(
        signature_id,
        wallet_locator,
        signer=signer,
        approvals=approvals
    )

def get_all_signatures(
    api_client: CrossmintWalletsAPI,
    wallet_locator: str
) -> List[Dict[str, Any]]:
    return api_client.get_signatures(wallet_locator)

def main():
    api_client = setup_api_client()
    email = os.getenv("CROSSMINT_USER_EMAIL")
    
    if not email:
        raise ValueError("CROSSMINT_USER_EMAIL environment variable is required")
    
    # EVM signature example
    evm_wallet_locator = f"email:{email}:evm-smart-wallet"
    message = "Hello, EVM!"
    
    evm_sig = create_signature(api_client, evm_wallet_locator, message, "evm")
    print(f"Created EVM signature request: {evm_sig}")
    
    # Monitor and approve EVM signature
    while True:
        status = get_signature_status(api_client, evm_sig["id"], evm_wallet_locator)
        print(f"EVM signature status: {status}")
        
        if status["status"] == "awaiting-approval":
            approve_signature(api_client, evm_sig["id"], evm_wallet_locator)
        elif status["status"] in ["success", "failed"]:
            break
            
        time.sleep(3)
    
    # Get all signatures
    evm_signatures = get_all_signatures(api_client, evm_wallet_locator)
    print(f"EVM signature history: {evm_signatures}")
    
    # Solana signature example
    solana_wallet_locator = f"email:{email}:solana-smart-wallet"
    message = "Hello, Solana!"
    
    solana_sig = create_signature(api_client, solana_wallet_locator, message, "solana")
    print(f"Created Solana signature request: {solana_sig}")
    
    # Monitor and approve Solana signature
    while True:
        status = get_signature_status(api_client, solana_sig["id"], solana_wallet_locator)
        print(f"Solana signature status: {status}")
        
        if status["status"] == "awaiting-approval":
            approve_signature(api_client, solana_sig["id"], solana_wallet_locator)
        elif status["status"] in ["success", "failed"]:
            break
            
        time.sleep(3)
    
    # Get all signatures
    solana_signatures = get_all_signatures(api_client, solana_wallet_locator)
    print(f"Solana signature history: {solana_signatures}")

if __name__ == "__main__":
    main()
