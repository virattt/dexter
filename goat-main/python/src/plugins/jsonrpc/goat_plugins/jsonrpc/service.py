import aiohttp
from goat.decorators.tool import Tool
from .parameters import JSONRpcBodyParameters

class JSONRpcService:
    def __init__(self, endpoint: str):
        self.endpoint = endpoint

    @Tool({
        "description": "Make a remote procedure call to a JSON RPC endpoint",
        "parameters_schema": JSONRpcBodyParameters
    })
    async def JSONRpcFunc(self, parameters: dict):
        """Makes a POST request to the configured endpoint with the required JSON-RPC parameters."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(self.endpoint, json=parameters) as response:
                    if not response.ok:
                        raise Exception(f"HTTP error! status: {response.status}, body: {await response.text()}")
                    return await response.json()
        except Exception as e:
            raise Exception(f"Failed to call {self.endpoint}: {e}")
