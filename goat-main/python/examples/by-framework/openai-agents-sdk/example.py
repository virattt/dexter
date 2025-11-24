import os
import asyncio
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from agents.agent import Agent
from agents.run import Runner

from web3 import Web3
from web3.middleware import SignAndSendRawMiddlewareBuilder
from eth_account.signers.local import LocalAccount
from eth_account import Account

from goat_adapters.openai_agents_sdk.adapter import get_on_chain_tools
from goat_wallets.evm import PEPE, USDC
from goat_wallets.web3 import web3

# Initialize Web3 and account
w3 = Web3(Web3.HTTPProvider(os.getenv("RPC_PROVIDER_URL")))
private_key = os.getenv("WALLET_PRIVATE_KEY")
assert private_key is not None, "You must set WALLET_PRIVATE_KEY environment variable"
assert private_key.startswith("0x"), "Private key must start with 0x hex prefix"

account: LocalAccount = Account.from_key(private_key)
w3.eth.default_account = account.address  # Set the default account
w3.middleware_onion.add(
    SignAndSendRawMiddlewareBuilder.build(account)
)  # Add middleware


async def main():
    # Initialize tools with web3 wallet
    tools = get_on_chain_tools(
        wallet=web3(w3),
        plugins=[],
    )
    
    agent = Agent(
        name="GOAT Agent",
        instructions=(
            "You are a helpful agent that can interact onchain using the GOAT SDK. "
        ),
        tools=tools
    )
    
    while True:
        user_input = input("\nYou: ").strip()
        
        if user_input.lower() == 'quit':
            print("Goodbye!")
            break
            
        try:
            response = await Runner.run(agent, user_input)

            print("\nAssistant:", response.final_output)
        except Exception as e:
            print("\nError:", str(e))


if __name__ == "__main__":
    asyncio.run(main())
