from typing import Optional

import requests
from solders.pubkey import Pubkey  # type: ignore

from solana_agentkit.types import JupiterTokenData


class TokenDataManager:
    @staticmethod
    def get_token_data_by_address(mint: Pubkey) -> Optional[JupiterTokenData]:
        try:
            if not mint:
                raise ValueError("Mint address is required")

            response = requests.get("https://tokens.jup.ag/tokens?tags=verified", headers={"Content-Type": "application/json"})
            response.raise_for_status()

            data = response.json()
            for token in data:
                if token.get("address") == str(mint):
                    return JupiterTokenData(
                        address=token.get("address"),
                        symbol=token.get("symbol"),
                        name=token.get("name"),
                    )
            return None
        except Exception as error:
            raise Exception(f"Error fetching token data: {str(error)}")
        
    @staticmethod
    def get_token_address_from_ticker(ticker: str) -> Optional[str]:
        try:
            response = requests.get(f"https://api.dexscreener.com/latest/dex/search?q={ticker}")
            response.raise_for_status()

            data = response.json()
            if not data.get("pairs"):
                return None

            solana_pairs = [
                pair for pair in data["pairs"] if pair.get("chainId") == "solana"
            ]
            solana_pairs.sort(key=lambda x: x.get("fdv", 0), reverse=True)

            solana_pairs = [
                pair
                for pair in solana_pairs
                if pair.get("baseToken", {}).get("symbol", "").lower() == ticker.lower()
            ]

            if solana_pairs:
                return solana_pairs[0].get("baseToken", {}).get("address")
            return None
        except Exception as error:
            print(f"Error fetching token address from DexScreener: {str(error)}")
            return None
        
    @staticmethod
    def get_token_data_by_ticker(ticker: str) -> Optional[JupiterTokenData]:
        address = TokenDataManager.get_token_address_from_ticker(ticker)
        if not address:
            raise ValueError(f"Token address not found for ticker: {ticker}")
        
        return TokenDataManager.get_token_data_by_address(Pubkey.from_string(address))