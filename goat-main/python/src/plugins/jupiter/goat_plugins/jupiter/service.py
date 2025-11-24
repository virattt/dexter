import base64
import base58
import aiohttp
from goat.decorators.tool import Tool
from goat_wallets.solana.wallet import SolanaTransaction
from solders.message import MessageV0
from solders.transaction import VersionedTransaction
from .parameters import GetQuoteParameters, QuoteResponse
from goat_wallets.solana import SolanaWalletClient


class JupiterService:
    def __init__(self):
        self.base_url = "https://api.jup.ag/swap/v1"
        self._timeout = aiohttp.ClientTimeout(total=10)  # 10 second timeout

    @Tool({
        "description": "Get a quote for a swap on the Jupiter DEX",
        "parameters_schema": GetQuoteParameters
    })
    async def get_quote(self, parameters: dict) -> dict:
        """Get a quote for swapping tokens using Jupiter."""
        try:
            params = GetQuoteParameters.model_validate(parameters)
            # Convert parameters to dict and ensure required fields are properly formatted
            request_params = {
                'inputMint': params.inputMint,
                'outputMint': params.outputMint,
                'amount': str(params.amount),
                'swapMode': params.swapMode.value,
                'maxAccounts': params.maxAccounts,
            }

            # Add optional parameters if they are set
            if params.slippageBps is not None:
                request_params['slippageBps'] = int(params.slippageBps)
                request_params['dynamicSlippage'] = str(False).lower()
            else:
                request_params['dynamicSlippage'] = str(True).lower()
            if params.onlyDirectRoutes is not None:
                request_params['onlyDirectRoutes'] = str(params.onlyDirectRoutes).lower()
            if params.restrictIntermediateTokens is not None:
                request_params['restrictIntermediateTokens'] = str(params.restrictIntermediateTokens).lower()
            if params.platformFeeBps is not None:
                request_params['platformFeeBps'] = int(params.platformFeeBps)
                
            print(f"Requesting quote with parameters: {request_params}")
            async with aiohttp.ClientSession(timeout=self._timeout) as session:
                async with session.get(f"{self.base_url}/quote", params=request_params) as response:
                    response_text = await response.text()
                    print(f"Got response: {response_text}")

                    if response.status != 200:
                        try:
                            error_data = await response.json()
                            raise Exception(
                                f"Failed to get quote: {error_data.get('error', 'Unknown error')}")
                        except:
                            raise Exception(
                                f"Failed to get quote: {response_text}")

                    response_data = await response.json()
                    QuoteResponse.model_validate(response_data)

                    return response_data
        except aiohttp.ClientResponseError as error:
            error_message = f"Failed to get quote: {str(error)}"
            if error.status != 404:  # Only try to parse response for non-404 errors
                try:
                    error_message = f"Failed to get quote: HTTP {error.status} - {error.message}"
                except:
                    pass
            raise Exception(error_message)
        except Exception as error:
            raise Exception(f"Failed to get quote: {str(error)}")

    @Tool({
        "description": "Swap an SPL token for another token on the Jupiter DEX",
        "parameters_schema": GetQuoteParameters
    })
    async def swap_tokens(self, wallet_client: SolanaWalletClient, parameters: dict):
        """Swap tokens using Jupiter DEX."""
        try:
            # First get the quote
            quote_response = await self.get_quote(parameters)

            # Prepare the full swap request
            swap_request = {
                "quoteResponse": quote_response,
                "userPublicKey": wallet_client.get_address(),
            }

            # Get swap transaction
            async with aiohttp.ClientSession(timeout=self._timeout) as session:
                async with session.post(f"{self.base_url}/swap", json=swap_request) as response:
                    if response.status != 200:
                        error_data = await response.json()
                        raise Exception(
                            f"Failed to create swap transaction: {error_data.get('error', 'Unknown error')}")

                    swap_response = await response.json()
                    swap_transaction = swap_response.get("swapTransaction")

                    if not swap_transaction:
                        raise Exception("No swap transaction returned")

                    base58_tx = base58.b58encode(
                        base64.b64decode(swap_transaction)).decode()

                    # Send the raw transaction directly
                    result = wallet_client.send_raw_transaction(
                        base58_tx)

                    return {
                        "hash": result["hash"]
                    }

        except Exception as error:
            # if error includes 0x1771
            if "0x1771" in str(error):
                raise Exception(
                    f"Slippage tolerance exceeded {parameters['slippageBps']} bps")

            raise Exception(f"Failed to swap tokens: {error}")
