import os
import time
from typing import Dict, Any, List, Optional, Union
from solana.rpc.api import Client as SolanaClient
from solders.instruction import Instruction
from solders.pubkey import Pubkey
from solders.message import Message
from goat_wallets.crossmint.api_client import CrossmintWalletsAPI
from goat_wallets.crossmint.parameters import (
    SolanaSmartWalletTransactionParams
)

def setup_api_client() -> CrossmintWalletsAPI:
    api_key = os.getenv("CROSSMINT_API_KEY")
    base_url = os.getenv("CROSSMINT_BASE_URL", "https://staging.crossmint.com")
    
    if not api_key:
        raise ValueError("CROSSMINT_API_KEY environment variable is required")
    
    return CrossmintWalletsAPI(api_key=api_key, base_url=base_url)

def multi_signer_transaction(
    api_client: CrossmintWalletsAPI,
    wallet_locator: str,
    signers: List[str],
    instructions: List[Instruction]
) -> Dict[str, Any]:
    """Create and execute a transaction requiring multiple signers."""
    wallet = api_client.get_wallet(wallet_locator)
    message = Message(
        instructions=instructions,
        payer=Pubkey.from_string(wallet["address"])
    )
    
    params = SolanaSmartWalletTransactionParams(
        transaction=message.serialize().hex(),
        required_signers=signers
    )
    
    response = api_client.create_transaction_for_smart_wallet(wallet_locator, params)
    
    # Monitor transaction status
    while True:
        status = api_client.check_transaction_status(wallet_locator, response["id"])
        print(f"Transaction status: {status}")
        
        if status["status"] == "awaiting-approval":
            approvals = []
            for signer in signers:
                approvals.append({
                    "signer": signer,
                    "signature": None
                })
            api_client.approve_transaction(
                wallet_locator,
                response["id"],
                approvals=approvals
            )
        elif status["status"] in ["success", "failed"]:
            return status
            
        time.sleep(3)

def time_bound_delegated_signer(
    api_client: CrossmintWalletsAPI,
    wallet_locator: str,
    signer: str,
    chain: str,
    duration_hours: int = 24
) -> Dict[str, Any]:
    """Register a delegated signer with time-bound permissions."""
    expires_at = int(time.time() * 1000) + (duration_hours * 60 * 60 * 1000)
    
    return api_client.register_delegated_signer(
        wallet_locator,
        signer,
        chain,
        expires_at,
    )

def main():
    api_client = setup_api_client()
    email = os.getenv("CROSSMINT_USER_EMAIL")
    delegated_email = os.getenv("CROSSMINT_DELEGATED_EMAIL")
    
    if not all([email, delegated_email]):
        raise ValueError("CROSSMINT_USER_EMAIL and CROSSMINT_DELEGATED_EMAIL are required")
    
    # Ensure email values are strings
    email_str = str(email)
    delegated_email_str = str(delegated_email)
    
    # Example: Multi-signer transaction
    solana_wallet_locator = f"email:{email_str}:solana-smart-wallet"
    rpc_url = os.getenv("SOLANA_RPC_ENDPOINT", "https://api.devnet.solana.com")
    connection = SolanaClient(rpc_url)
    
    # Example: SOL transfer requiring multiple signers
    recipient = Pubkey.from_string("11111111111111111111111111111111")
    amount = 1_000_000_000  # 1 SOL in lamports
    
    instructions = [
        Instruction(
            program_id=Pubkey.from_string("11111111111111111111111111111111"),
            accounts=[
                {"pubkey": Pubkey.from_string(api_client.get_wallet(solana_wallet_locator)["address"]), "is_signer": True, "is_writable": True},
                {"pubkey": recipient, "is_signer": False, "is_writable": True}
            ],
            data=bytes([2, 0, 0, 0] + list(amount.to_bytes(8, "little")))
        )
    ]
    
    signers = [email_str, delegated_email_str]
    result = multi_signer_transaction(api_client, solana_wallet_locator, signers, instructions)
    print(f"Multi-signer transaction result: {result}")
    
    # Example: Time-bound delegated signer
    time_bound_signer = time_bound_delegated_signer(
        api_client,
        solana_wallet_locator,
        delegated_email_str,
        "solana",
        duration_hours=2
    )
    print(f"Registered time-bound delegated signer: {time_bound_signer}")

if __name__ == "__main__":
    main()
