import aiohttp


class TokenPriceFetcher:
    @staticmethod
    async def fetch_price(token_id: str) -> str:
        """
        Fetch the price of a given token in USDC using Jupiter API.

        Args:
            token_id (str): The token mint address.

        Returns:
            str: The price of the token in USDC.

        Raises:
            Exception: If the fetch request fails or price data is unavailable.
        """
        url = f"https://api.jup.ag/price/v2?ids={token_id}"

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as response:
                    if response.status != 200:
                        raise Exception(f"Failed to fetch price: {response.status}")

                    data = await response.json()
                    price = data.get("data", {}).get(token_id, {}).get("price")

                    if not price:
                        raise Exception("Price data not available for the given token.")

                    return str(price)
        except Exception as e:
            raise Exception(f"Price fetch failed: {str(e)}")