import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate
from solana.rpc.api import Client as SolanaClient
from solders.keypair import Keypair

from goat_adapters.langchain import get_on_chain_tools
from goat_wallets.solana import solana
from goat_wallets.crossmint import crossmint

# Configure environment
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
WALLET_PRIVATE_KEY = os.getenv("WALLET_PRIVATE_KEY")
RPC_PROVIDER_URL = os.getenv("RPC_PROVIDER_URL")
CROSSMINT_API_KEY = os.getenv("CROSSMINT_API_KEY")

if not all([OPENAI_API_KEY, WALLET_PRIVATE_KEY, RPC_PROVIDER_URL, CROSSMINT_API_KEY]):
    raise ValueError("Missing required environment variables. Check your .env file.")

# Initialize Solana client
client = SolanaClient(RPC_PROVIDER_URL)

# Initialize Solana wallet
keypair = Keypair.from_base58_string(WALLET_PRIVATE_KEY)
wallet = solana(client, keypair)

# Initialize LLM
llm = ChatOpenAI(model="gpt-4o-mini")

def main():
    print("Welcome to the Mint NFT on Solana using Crossmint example!")
    print("This agent can:")
    print("- Create a wallet for an X/Twitter user or email")
    print("- Mint an NFT to the wallet")
    print("\nType 'exit' to quit the conversation.\n")

    # Get the prompt template
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", """You are a helpful NFT minting assistant. 
You can help users create wallets for X/Twitter users or emails and mint NFTs to those wallets.

When a user asks you to mint an NFT, remember to:
1. Create a collection if none exists
2. Check if a wallet exists for the recipient, or create one
3. Mint the NFT to the recipient's wallet

Only use the provided tools to interact with the blockchain."""),
            ("placeholder", "{chat_history}"),
            ("human", "{input}"),
            ("placeholder", "{agent_scratchpad}"),
        ]
    )

    # Initialize tools with Solana wallet and Crossmint
    crossmint_plugins = crossmint(CROSSMINT_API_KEY)
    
    tools = get_on_chain_tools(
        wallet=wallet,
        plugins=[
            crossmint_plugins["mint"](),
        ],
    )
    
    agent = create_tool_calling_agent(llm, tools, prompt)
    agent_executor = AgentExecutor(agent=agent, tools=tools, handle_parsing_errors=True, verbose=True)

    while True:
        user_input = input("\nYou: ")
        
        if user_input.lower() == "exit":
            print("Goodbye!")
            break
            
        try:
            response = agent_executor.invoke({
                "input": user_input,
            })

            print("\nAssistant:", response["output"])
        except Exception as e:
            print("\nError:", str(e))

if __name__ == "__main__":
    main() 