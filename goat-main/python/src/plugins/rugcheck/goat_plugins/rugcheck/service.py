import aiohttp
from goat.decorators.tool import Tool
from .parameters import GetTokenReportParameters, NoParameters


class RugCheckService:
    def __init__(self, jwt_token: str = "", base_url: str = "https://api.rugcheck.xyz/v1"):
        self.jwt_token = jwt_token
        self.base_url = base_url

    async def _make_request(self, endpoint: str):
        headers = {
            "Content-Type": "application/json",
        }
        
        async with aiohttp.ClientSession() as session:
            url = f"{self.base_url}{endpoint}"
            async with session.get(url, headers=headers) as response:
                if not response.ok:
                    if response.status == 429:
                        raise Exception("RugCheck API rate limit exceeded")
                    raise Exception(f"RugCheck API request failed: {response.status}")
                return await response.json()

    @Tool({
        "description": "Get recently detected tokens from RugCheck",
        "parameters_schema": NoParameters
    })
    async def get_recently_detected_tokens(self, parameters: dict):
        """Get recently detected tokens from RugCheck"""
        return await self._make_request("/stats/new_tokens")

    @Tool({
        "description": "Get trending tokens in the last 24h from RugCheck",
        "parameters_schema": NoParameters
    })
    async def get_trending_tokens_24h(self, parameters: dict):
        """Get trending tokens in the last 24h from RugCheck"""
        return await self._make_request("/stats/trending")

    @Tool({
        "description": "Get tokens with the most votes in the last 24h from RugCheck",
        "parameters_schema": NoParameters
    })
    async def get_most_voted_tokens_24h(self, parameters: dict):
        """Get tokens with the most votes in the last 24h from RugCheck"""
        return await self._make_request("/stats/recent")

    @Tool({
        "description": "Get recently verified tokens from RugCheck",
        "parameters_schema": NoParameters
    })
    async def get_recently_verified_tokens(self, parameters: dict):
        """Get recently verified tokens from RugCheck"""
        return await self._make_request("/stats/verified")

    @Tool({
        "description": "Generate a report summary for the given token mint",
        "parameters_schema": GetTokenReportParameters
    })
    async def generate_token_report_summary(self, parameters: dict):
        """Generate a report summary for the given token mint"""
        mint = parameters["mint"]
        return await self._make_request(f"/tokens/{mint}/report/summary")
