import aiohttp
from goat.decorators.tool import Tool
from goat_wallets.solana import SolanaWalletClient
from .parameters import DepositUSDCParameters


class LuloService:
    def __init__(self):
        pass

    @Tool({
        "description": "Deposit USDC into Lulo",
        "parameters_schema": DepositUSDCParameters
    })
    async def deposit_usdc(self, wallet_client: SolanaWalletClient, parameters: dict):
        """Deposit USDC into Lulo."""
        try:
            response = await self._make_deposit_request(wallet_client, parameters["amount"])
            tx = wallet_client.send_raw_transaction(response["transaction"])
            return tx["hash"]
        except Exception as error:
            raise Exception(f"Failed to deposit USDC: {error}")

    async def _make_deposit_request(self, wallet_client: SolanaWalletClient, amount: str):
        """Make a deposit request to Lulo."""
        async with aiohttp.ClientSession() as session:
            url = f"https://blink.lulo.fi/actions?amount={amount}&symbol=USDC"
            async with session.post(
                url,
                headers={"Content-Type": "application/json"},
                json={"account": wallet_client.get_address()}
            ) as response:
                if not response.ok:
                    raise Exception(f"HTTP error! status: {response.status} {await response.text()}")
                return await response.json()
