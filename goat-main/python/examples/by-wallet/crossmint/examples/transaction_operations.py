import os
import time
from typing import Dict, Any, List, Optional
from solana.rpc.api import Client as SolanaClient
from solders.instruction import Instruction
from solders.pubkey import Pubkey
from solders.message import Message
from goat_wallets.crossmint.api_client import CrossmintWalletsAPI
from goat_wallets.crossmint.parameters import SolanaSmartWalletTransactionParams

def setup_api_client() -> CrossmintWalletsAPI:
    api_key = os.getenv("CROSSMINT_API_KEY")
    base_url = os.getenv("CROSSMINT_BASE_URL", "https://staging.crossmint.com")
    
    if not api_key:
        raise ValueError("CROSSMINT_API_KEY environment variable is required")
    
    return CrossmintWalletsAPI(api_key=api_key, base_url=base_url)

def create_evm_transaction(
    api_client: CrossmintWalletsAPI,
    wallet_locator: str,
    to_address: str,
    value: str,
    data: str = "0x"
) -> Dict[str, Any]:
    params = {
        "calls": [{
            "to": to_address,
            "value": value,
            "data": data
        }],
        "chain": "base"
    }
    
    response = api_client.create_transaction_for_smart_wallet(wallet_locator, params)
    return response

def create_solana_transaction(
    api_client: CrossmintWalletsAPI,
    wallet_locator: str,
    instructions: List[Instruction]
) -> Dict[str, Any]:
    wallet = api_client.get_wallet(wallet_locator)
    message = Message(
        instructions=instructions,
        payer=Pubkey.from_string(wallet["address"])
    )
    
    params = SolanaSmartWalletTransactionParams(
        transaction=message.serialize().hex()
    )
    
    response = api_client.create_transaction_for_smart_wallet(wallet_locator, params)
    return response

def get_transaction_status(
    api_client: CrossmintWalletsAPI,
    wallet_locator: str,
    transaction_id: str
) -> Dict[str, Any]:
    return api_client.check_transaction_status(wallet_locator, transaction_id)

def approve_transaction(
    api_client: CrossmintWalletsAPI,
    wallet_locator: str,
    transaction_id: str,
    signer: Optional[str] = None,
    approvals: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    return api_client.approve_transaction(wallet_locator, transaction_id, signer, approvals)

def get_transaction_history(
    api_client: CrossmintWalletsAPI,
    wallet_locator: str
) -> List[Dict[str, Any]]:
    return api_client.get_wallet_transactions(wallet_locator)

def main():
    api_client = setup_api_client()
    email = os.getenv("CROSSMINT_USER_EMAIL")
    
    if not email:
        raise ValueError("CROSSMINT_USER_EMAIL environment variable is required")
    
    # EVM transaction example
    evm_wallet_locator = f"email:{email}:evm-smart-wallet"
    evm_tx = create_evm_transaction(
        api_client,
        evm_wallet_locator,
        "0x1234567890123456789012345678901234567890",
        "1000000000000000000"  # 1 ETH in wei
    )
    print(f"Created EVM transaction: {evm_tx}")
    
    # Monitor and approve EVM transaction
    while True:
        status = get_transaction_status(api_client, evm_wallet_locator, evm_tx["id"])
        print(f"EVM transaction status: {status}")
        
        if status["status"] == "awaiting-approval":
            approve_transaction(api_client, evm_wallet_locator, evm_tx["id"])
        elif status["status"] in ["success", "failed"]:
            break
            
        time.sleep(3)
    
    # Get transaction history
    evm_history = get_transaction_history(api_client, evm_wallet_locator)
    print(f"EVM transaction history: {evm_history}")
    
    # Solana transaction example
    solana_wallet_locator = f"email:{email}:solana-smart-wallet"
    rpc_url = os.getenv("SOLANA_RPC_ENDPOINT", "https://api.devnet.solana.com")
    connection = SolanaClient(rpc_url)
    
    # Example: SOL transfer instruction
    recipient = Pubkey.from_string("11111111111111111111111111111111")
    amount = 1_000_000_000  # 1 SOL in lamports
    
    instructions = [
        # System program transfer instruction
        Instruction(
            program_id=Pubkey.from_string("11111111111111111111111111111111"),
            accounts=[
                {"pubkey": Pubkey.from_string(api_client.get_wallet(solana_wallet_locator)["address"]), "is_signer": True, "is_writable": True},
                {"pubkey": recipient, "is_signer": False, "is_writable": True}
            ],
            data=bytes([2, 0, 0, 0] + list(amount.to_bytes(8, "little")))
        )
    ]
    
    solana_tx = create_solana_transaction(api_client, solana_wallet_locator, instructions)
    print(f"Created Solana transaction: {solana_tx}")
    
    # Monitor and approve Solana transaction
    while True:
        status = get_transaction_status(api_client, solana_wallet_locator, solana_tx["id"])
        print(f"Solana transaction status: {status}")
        
        if status["status"] == "awaiting-approval":
            approve_transaction(api_client, solana_wallet_locator, solana_tx["id"])
        elif status["status"] in ["success", "failed"]:
            break
            
        time.sleep(3)
    
    # Get transaction history
    solana_history = get_transaction_history(api_client, solana_wallet_locator)
    print(f"Solana transaction history: {solana_history}")

if __name__ == "__main__":
    main()
