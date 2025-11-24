import os
from dotenv import load_dotenv
from goat_wallets.crossmint.api_client import CrossmintWalletsAPI
from solders.keypair import Keypair
from solana.rpc.api import Client as SolanaClient
import base58

# CrewAI imports
from crewai import Agent, Task, Crew, Process

# GOAT imports
from goat_adapters.crewai.adapter import get_crewai_tools
from goat_wallets.solana import SPL_TOKENS
from goat_wallets.crossmint.parameters import CoreSignerType
from goat_wallets.crossmint.solana_smart_wallet_factory import SolanaSmartWalletFactory
from goat_wallets.crossmint.types import SolanaKeypairSigner
from goat_wallets.crossmint.solana_smart_wallet import SolanaSmartWalletConfig

# Load environment variables
load_dotenv()

# --- Setup GOAT Wallet and Plugins ---
print("Initializing Solana wallet and GOAT plugins...")
openai_api_key = os.getenv("OPENAI_API_KEY")  # CrewAI requires OpenAI key by default
solana_delegated_key = os.getenv("SOLANA_DELEGATED_KEY")
solana_wallet_address = os.getenv("SOLANA_WALLET_ADDRESS")
crossmint_wallet_userid = os.getenv("CROSSMINT_WALLET_USERID")
crossmint_api_key = os.getenv("CROSSMINT_API_KEY")
crossmint_base_url = os.getenv("CROSSMINT_BASE_URL", "https://staging.crossmint.com")
solana_rpc_endpoint = os.getenv("SOLANA_RPC_ENDPOINT", "https://api.devnet.solana.com")

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

try:
    # Decode the base58 secret key string into bytes
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

    # Get CrewAI-compatible tools from GOAT adapter
    goat_crewai_tools = get_crewai_tools(wallet=wallet, plugins=[])
    if not goat_crewai_tools:
        print("Warning: No GOAT tools were loaded. Check adapter/plugin setup or tool compatibility.")
        # Optionally exit if tools are essential
        # exit(1)
    else:
        print(f"Successfully loaded {len(goat_crewai_tools)} GOAT tools for CrewAI.")

except Exception as e:
    print(f"Error during initialization: {e}")
    exit(1)

# --- Define CrewAI Agent ---
print("Defining CrewAI Agent...")
crypto_analyst = Agent(
    role="Solana SPL Token Analyst",
    goal="Provide accurate answers to user questions about Solana SPL tokens using available on-chain tools.",
    backstory=(
        "You are an expert analyst focused on the Solana blockchain and its SPL token ecosystem. "
        "You have access to specialized tools that can query SPL token balances and potentially other relevant information directly from the blockchain. "
        "Your task is to understand the user's question, use the appropriate tool(s) if necessary, and provide a clear, concise answer based *only* on the information retrieved from the tools. "
        "If the tools cannot provide the information needed to answer the question, clearly state that."
    ),
    verbose=True,
    allow_delegation=False,
    tools=goat_crewai_tools,  # Pass the generated GOAT tools
    # Assumes OPENAI_API_KEY is set in the environment
)

# --- Define CrewAI Task ---
print("Defining CrewAI Task...")
analysis_task = Task(
    description=(
        'Answer the user\'s question: "{user_question}". '
        "Use your available tools to find information about Solana SPL tokens (like balances) related to the question. "
        "Synthesize the results from the tools into a final, comprehensive answer."
    ),
    expected_output=(
        "A clear, accurate answer to the user's question based *only* on the information retrieved by the tools. "
        "If the tools cannot answer the question, state that clearly."
    ),
    agent=crypto_analyst,
)

# --- Create Crew ---
print("Creating Crew...")
crypto_crew = Crew(agents=[crypto_analyst], tasks=[analysis_task], process=Process.sequential, verbose=True)


# --- Interactive Loop ---
def run_interactive_loop():
    print("\n--- Solana SPL Token Analyst ---")
    print("Ask questions about SPL tokens (using configured wallet and network). Type 'quit' to exit.")
    while True:
        try:
            user_query = input("\nYour question: ")
            if user_query.lower() == "quit":
                print("Exiting...")
                break
            if not user_query.strip():
                continue

            print("\nProcessing your request with the crew...")
            # Kick off the crew with the user's question
            result = crypto_crew.kickoff(inputs={"user_question": user_query})

            print("\n✅ --- Crew Finished ---")
            print("Final Answer:")
            print(result)
            print("--------------------\n")

        except Exception as e:
            print(f"\n❌ An error occurred during the crew execution: {e}")
        except KeyboardInterrupt:
            print("\nExiting...")
            break


if __name__ == "__main__":
    run_interactive_loop()
