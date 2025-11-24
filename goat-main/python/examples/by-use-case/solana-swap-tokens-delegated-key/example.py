import os
import base58
from dotenv import load_dotenv
from goat_wallets.crossmint.api_client import CrossmintWalletsAPI
from goat_wallets.crossmint.parameters import CoreSignerType
from goat_wallets.crossmint.solana_smart_wallet import SolanaSmartWalletConfig
from goat_wallets.crossmint.solana_smart_wallet_factory import SolanaSmartWalletFactory
from goat_wallets.crossmint.types import SolanaKeypairSigner

# Load environment variables
load_dotenv()

from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate
from solana.rpc.api import Client as SolanaClient
from solders.keypair import Keypair

from goat_adapters.langchain import get_on_chain_tools
from goat_plugins.jupiter import jupiter, JupiterPluginOptions
from goat_wallets.solana import SPL_TOKENS

# Initialize Solana client
client = SolanaClient(os.getenv("SOLANA_RPC_ENDPOINT"))

openai_api_key = os.getenv("OPENAI_API_KEY")  # CrewAI requires OpenAI key by default
solana_delegated_key = os.getenv("SOLANA_DELEGATED_KEY")
solana_wallet_address = os.getenv("SOLANA_WALLET_ADDRESS")
crossmint_wallet_userid = os.getenv("CROSSMINT_WALLET_USERID")
crossmint_api_key = os.getenv("CROSSMINT_API_KEY")
crossmint_base_url = os.getenv("CROSSMINT_BASE_URL", "https://www.crossmint.com")
solana_rpc_endpoint = os.getenv("SOLANA_RPC_ENDPOINT", "https://api.mainnet-beta.solana.com")

if not solana_delegated_key or not solana_wallet_address:
    print("Error: Please set SOLANA_DELEGATED_KEY and SOLANA_WALLET_ADDRESS in your .env file.")
    exit(1)

if not crossmint_api_key:
    print("Error: Please set CROSSMINT_API_KEY in your .env file.")
    exit(1)

if not crossmint_wallet_userid:
    print("Error: Please set CROSSMINT_WALLET_USERID in your .env file.")
    exit(1)

# Check for OpenAI API key (needed by CrewAI's default LLM config)
if not openai_api_key:
    print("Error: Please set OPENAI_API_KEY in your .env file for CrewAI.")
    # You might want to configure a different LLM provider here if needed
    exit(1)

secret_key_bytes = base58.b58decode(solana_delegated_key)
# Load the keypair from the secret key bytes (seed)
delegated_keypair = Keypair.from_seed(secret_key_bytes) # Use from_seed for 32-byte secret

api_client = CrossmintWalletsAPI(api_key=crossmint_api_key, base_url=crossmint_base_url)
factory = SolanaSmartWalletFactory(api_client, connection=SolanaClient(solana_rpc_endpoint))
wallet = factory.get_or_create({
    "config": SolanaSmartWalletConfig(
        adminSigner=SolanaKeypairSigner(
            type=CoreSignerType.SOLANA_KEYPAIR,
            keyPair=delegated_keypair
        )
    ),
    "userId": crossmint_wallet_userid,
    "tokens": SPL_TOKENS,
    "enable_send": True
})

# Initialize LLM
llm = ChatOpenAI(model="gpt-4o-mini")

def main():
    
    # Get the prompt template
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", "You are a helpful assistant"),
            ("placeholder", "{chat_history}"),
            ("human", "{input}"),
            ("placeholder", "{agent_scratchpad}"),
        ]
    )

    # Initialize tools with Solana wallet
    tools = get_on_chain_tools(
        wallet=wallet,
        plugins=[
            jupiter(JupiterPluginOptions()),  # No options needed for Jupiter v6
        ],
    )

    agent = create_tool_calling_agent(llm, tools, prompt)
    agent_executor = AgentExecutor(
        agent=agent, tools=tools, handle_parsing_errors=True, verbose=True
    )

    while True:
        user_input = input("\nYou: ").strip()

        if user_input.lower() == "quit":
            print("Goodbye!")
            break

        try:
            response = agent_executor.invoke(
                {
                    "input": user_input,
                }
            )

            print("\nAssistant:", response["output"])
        except Exception as e:
            print("\nError:", str(e))


if __name__ == "__main__":
    main()
