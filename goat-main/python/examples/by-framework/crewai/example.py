import os
from dotenv import load_dotenv
from solders.keypair import Keypair  # Import Keypair
from solana.rpc.api import Client as SolanaClient  # Import Solana Client

# CrewAI imports
from crewai import Agent, Task, Crew, Process

# GOAT imports
from goat_adapters.crewai.adapter import get_crewai_tools
from goat_wallets.solana import solana, SPL_TOKENS

# Load environment variables
load_dotenv()

# --- Setup GOAT Wallet and Plugins ---
print("Initializing Solana wallet and GOAT plugins...")
solana_rpc_endpoint = os.getenv("SOLANA_RPC_ENDPOINT")
solana_wallet_seed = os.getenv("SOLANA_WALLET_SEED")
openai_api_key = os.getenv("OPENAI_API_KEY")  # CrewAI requires OpenAI key by default

if not solana_rpc_endpoint or not solana_wallet_seed:
    print("Error: Please set SOLANA_RPC_ENDPOINT and SOLANA_WALLET_SEED in your .env file.")
    exit(1)

# Check for OpenAI API key (needed by CrewAI's default LLM config)
if not openai_api_key:
    print("Error: Please set OPENAI_API_KEY in your .env file for CrewAI.")
    # You might want to configure a different LLM provider here if needed
    exit(1)


try:
    client = SolanaClient(solana_rpc_endpoint)
    keypair = Keypair.from_base58_string(solana_wallet_seed)
    wallet = solana(client, keypair)

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
