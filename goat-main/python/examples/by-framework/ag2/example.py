import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from goat_adapters.ag2.adapter import register_tools
from web3 import Web3
from web3.middleware import SignAndSendRawMiddlewareBuilder
from eth_account.signers.local import LocalAccount
from eth_account import Account

from goat_wallets.evm import PEPE, USDC
from goat_wallets.web3 import web3

from autogen import ConversableAgent, LLMConfig


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

def main():
    llm_config = LLMConfig.from_json(path="OAI_CONFIG_LIST")

    # 2. Agent for determining whether to run the tool
    with llm_config:
        crypto_agent = ConversableAgent(
            name="crypto_agent",
            system_message="You are a crypto expert. You can use the tools provided to you to answer questions. You are given a message and you need to determine if it is a crypto related question. If it is, you should use the tools to answer the question. If it is not, you should say that you do not know.",
        )

    # 3. And an agent for executing the tool
    executor_agent = ConversableAgent(
        name="executor_agent",
        human_input_mode="NEVER",
    )

    register_tools(
        caller=crypto_agent,
        executor=executor_agent,
        wallet=web3(w3),
        plugins=[],
    )

    crypto_agent.initiate_chat(
        recipient=executor_agent,
        message="What is the balance of the wallet in USDC?",
        max_turns=5,
    )
    
if __name__ == "__main__":
    main()
