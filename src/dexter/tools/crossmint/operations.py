"""Crossmint wallet operations including swaps and yield deposits."""

import asyncio
from typing import Optional, Dict, Any
from solders.pubkey import Pubkey
from solders.instruction import Instruction, AccountMeta
from goat_wallets.crossmint.solana_smart_wallet import SolanaSmartWalletClient
from goat_plugins.jupiter.service import JupiterService
from goat_plugins.lulo import lulo, LuloPluginOptions
from goat_adapters.langchain import get_on_chain_tools


class CrossmintOperations:
    """Handles Crossmint wallet operations like swaps and yield deposits."""
    
    @staticmethod
    def create_memo_instruction(fee_payer: Pubkey, memo: str) -> Instruction:
        """
        Create a memo instruction.
        
        Args:
            fee_payer: The fee payer public key
            memo: The memo message
            
        Returns:
            Instruction object
        """
        memo_program_id = Pubkey.from_string("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr")
        accounts = [AccountMeta(pubkey=fee_payer, is_signer=False, is_writable=False)]
        data = bytes(memo, "utf-8")
        return Instruction(memo_program_id, data, accounts)
    
    @staticmethod
    def send_memo(wallet: SolanaSmartWalletClient, memo: str) -> Dict[str, Any]:
        """
        Send a memo transaction.
        
        Args:
            wallet: Crossmint wallet instance
            memo: Memo message
            
        Returns:
            Transaction response
        """
        print(f"\n💸 Sending memo transaction...")
        print(f"📝 Message: {memo}")
        
        instruction = CrossmintOperations.create_memo_instruction(
            Pubkey.from_string(wallet.get_address()),
            memo
        )
        
        response = wallet.send_transaction({"instructions": [instruction]})
        
        print(f"✅ Transaction sent successfully!")
        print(f"🔗 Transaction Hash: {response.get('hash')}")
        
        return response
    
    @staticmethod
    async def swap_tokens(
        wallet: SolanaSmartWalletClient,
        input_mint: str,
        output_mint: str,
        amount: int,
        slippage_bps: int = 100
    ) -> Dict[str, Any]:
        """
        Swap tokens using Jupiter DEX.
        
        Args:
            wallet: Crossmint wallet instance
            input_mint: Input token mint address
            output_mint: Output token mint address
            amount: Amount to swap (in smallest unit)
            slippage_bps: Slippage in basis points (default 100 = 1%)
            
        Returns:
            Transaction response
        """
        print(f"\n💱 Preparing token swap...")
        print(f"📝 From: {input_mint}")
        print(f"📝 To: {output_mint}")
        print(f"📝 Amount: {amount}")
        print(f"📝 Slippage: {slippage_bps / 100}%")
        
        jupiter_service = JupiterService()
        
        response = await jupiter_service.swap_tokens(
            wallet,
            {
                "inputMint": input_mint,
                "outputMint": output_mint,
                "amount": amount,
                "slippageBps": slippage_bps,
            }
        )
        
        print(f"✅ Swap transaction sent successfully!")
        print(f"🔗 Transaction Hash: {response.get('hash')}")
        
        return response
    
    @staticmethod
    async def deposit_to_lulo(
        wallet: SolanaSmartWalletClient,
        amount_usdc: float
    ) -> Dict[str, Any]:
        """
        Deposit USDC to Lulo yield platform.
        
        Args:
            wallet: Crossmint wallet instance
            amount_usdc: Amount of USDC to deposit
            
        Returns:
            Transaction response
        """
        print(f"\n💰 Depositing to Lulo yield platform...")
        print(f"📝 Amount: {amount_usdc} USDC")
        
        # Get Lulo tools
        tools = get_on_chain_tools(
            wallet=wallet,
            plugins=[lulo(LuloPluginOptions())]
        )
        
        # Find the deposit tool
        deposit_tool = next((t for t in tools if "deposit" in t.name.lower()), None)
        
        if not deposit_tool:
            raise ValueError("Lulo deposit tool not found")
        
        # Execute deposit
        result = await deposit_tool.ainvoke({"amount": int(amount_usdc * 1e6)})
        
        print(f"✅ Deposit successful!")
        
        return result
    
    @staticmethod
    def check_balance(
        wallet: SolanaSmartWalletClient,
        token: str = "sol"
    ) -> Optional[float]:
        """
        Check wallet balance for a specific token.
        
        Args:
            wallet: Crossmint wallet instance
            token: Token symbol to check (default: "sol")
            
        Returns:
            Balance amount or None if not found
        """
        balances = wallet.balance_of([token])
        
        if not balances:
            return None
        
        balance_data = balances[0]
        total_balance = balance_data.get("balances", {}).get("total")
        
        if total_balance is None:
            return None
        
        return int(total_balance)
    
    @staticmethod
    def wait_for_balance(
        wallet: SolanaSmartWalletClient,
        token: str,
        minimum_amount: int,
        check_interval: int = 5
    ) -> float:
        """
        Wait until wallet has minimum balance.
        
        Args:
            wallet: Crossmint wallet instance
            token: Token symbol to check
            minimum_amount: Minimum amount required (in smallest unit)
            check_interval: Check interval in seconds
            
        Returns:
            Current balance when minimum is reached
        """
        print(f"\n🔄 Checking {token.upper()} balance...")
        
        while True:
            balance = CrossmintOperations.check_balance(wallet, token)
            
            if balance is None:
                print(f"❌ No {token.upper()} balance found")
            else:
                decimals = 9 if token.lower() == "sol" else 6  # SOL has 9, most tokens have 6
                ui_balance = balance / (10 ** decimals)
                ui_minimum = minimum_amount / (10 ** decimals)
                
                print(f"💰 Current balance: {ui_balance} {token.upper()}")
                
                if balance >= minimum_amount:
                    print(f"✅ Balance {ui_balance} {token.upper()} is sufficient!")
                    return float(balance)
            
            print(f"⏳ Minimum required: {ui_minimum} {token.upper()}")
            print(f"💡 Please fund your wallet and press Enter to check again...")
            input()
