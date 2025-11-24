from dataclasses import dataclass
from solana.transaction import Transaction

from solana_agentkit.types.publickey import PublicKey

@dataclass
class CreateAccountParams:
    from_pubkey: PublicKey
    new_account_pubkey: PublicKey
    lamports: int
    space: int
    program_id: PublicKey

def create_account(params: CreateAccountParams):
    """Create a new account."""
    transaction = Transaction()
    transaction.add(
        create_account(
            params.from_pubkey,
            params.new_account_pubkey,
            params.lamports,
            params.space,
            params.program_id
        )
    )
    return transaction
@dataclass
class TransferParams:
    from_pubkey: PublicKey
    to_pubkey: PublicKey
    lamports: int

def transfer(params: TransferParams):
    """Transfer lamports from one account to another."""
    transaction = Transaction()
    transaction.add(
        Transaction(
            from_pubkey=params.from_pubkey,
            to_pubkey=params.to_pubkey,
            lamports=params.lamports
        )
    )
    return transaction