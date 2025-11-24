from solana.rpc.api import Client
from solana.rpc.types import TxOpts
from solana.transaction import Transaction
from solders.compute_budget import set_compute_unit_limit  # type: ignore
from solders.compute_budget import set_compute_unit_price  # type: ignore
from solders.pubkey import Pubkey  # type: ignore
from spl.token.constants import TOKEN_PROGRAM_ID
from spl.token.instructions import (BurnParams, CloseAccountParams, burn,
                                    close_account)

from solana_agentkit.agent import SolanaAgentKit


class BurnManager:
    @staticmethod
    def burn_and_close_account(agent:SolanaAgentKit, token_account: str):
        """
        Burns tokens and closes the given token account.

        Parameters:
        agent (SolanaAgentKit): The agent instance containing wallet and RPC configuration.
        token_account (str): The public key of the token account to process.
        """
        token_account_pubkey = Pubkey.from_string(token_account)

        try:
            client = Client(agent.rpc_url)
            token_balance = int(client.get_token_account_balance(token_account_pubkey).value.amount)
            print(f"Token Balance for {token_account}: {token_balance}")
        except Exception as e:
            print(f"Error fetching token balance for {token_account}: {e}")
            return

        owner = agent.wallet.pubkey()
        recent_blockhash = client.get_latest_blockhash().value.blockhash

        transaction = Transaction()
        transaction.fee_payer = owner
        transaction.recent_blockhash = recent_blockhash

        if token_balance > 0:
            try:
                mint_str = client.get_account_info_json_parsed(token_account_pubkey).value.data.parsed['info']['mint']
                mint = Pubkey.from_string(mint_str)
                burn_instruction = burn(
                    BurnParams(
                        program_id=TOKEN_PROGRAM_ID,
                        account=token_account_pubkey,
                        mint=mint,
                        owner=owner,
                        amount=token_balance
                    )
                )
                transaction.add(burn_instruction)
            except Exception as e:
                print(f"Error preparing burn instruction for {token_account}: {e}")
                return

        close_account_instruction = close_account(
            CloseAccountParams(
                program_id=TOKEN_PROGRAM_ID,
                account=token_account_pubkey,
                dest=owner,
                owner=owner
            )
        )
        transaction.add(set_compute_unit_price(100_000))
        transaction.add(set_compute_unit_limit(100_000))
        transaction.add(close_account_instruction)

        try:
            transaction.sign(agent.wallet)
            txn_sig = client.send_transaction(transaction, agent.wallet, opts=TxOpts(skip_preflight=True)).value
            print(f"Transaction Signature for {token_account}: {txn_sig}")
        except Exception as e:
            print(f"Error sending transaction for {token_account}: {e}")

    @staticmethod
    def process_multiple_accounts(agent, token_accounts):
        """
        Processes multiple token accounts by burning and closing each one.

        Parameters:
        agent (SolanaAgentKit): The agent instance containing wallet and RPC configuration.
        token_accounts (list): List of token account public keys as strings.
        """
        for token_account in token_accounts:
            try:
                BurnManager.burn_and_close_account(agent, token_account)
            except Exception as e:
                print(f"Error processing token account {token_account}: {e}")