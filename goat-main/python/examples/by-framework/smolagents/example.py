import os
from dotenv import load_dotenv
from solders.keypair import Keypair  # Import Keypair
from solana.rpc.api import Client as SolanaClient  # Import Solana Client

# Smolagents imports
from smolagents import OpenAIServerModel, ToolCallingAgent

# GOAT imports
from goat_adapters.smolagents import get_smolagents_tools
from goat_wallets.solana import solana, SPL_TOKENS

# Load environment variables
load_dotenv()

# --- Setup GOAT Wallet and Plugins ---
print("Initializing Solana wallet and GOAT plugins...")
solana_rpc_endpoint = os.getenv("SOLANA_RPC_ENDPOINT")
solana_wallet_seed = os.getenv("SOLANA_WALLET_SEED")
openai_api_key = os.getenv("OPENAI_API_KEY")

if not solana_rpc_endpoint or not solana_wallet_seed:
    print("Error: Please set SOLANA_RPC_ENDPOINT and SOLANA_WALLET_SEED in your .env file.")
    exit(1)

if not openai_api_key:
    print("Error: Please set OPENAI_API_KEY in your .env file to use GPT-4o.")
    exit(1)

try:
    client = SolanaClient(solana_rpc_endpoint)
    keypair = Keypair.from_base58_string(solana_wallet_seed)
    wallet = solana(client, keypair)

    # Get Smolagents-compatible tools from GOAT adapter
    goat_smolagents_tools = get_smolagents_tools(wallet=wallet, plugins=[])
    if not goat_smolagents_tools:
        print("Warning: No GOAT tools were loaded. Check adapter/plugin setup or tool compatibility.")
        # Optionally exit if tools are essential
        # exit(1)
    else:
        print(f"Successfully loaded {len(goat_smolagents_tools)} GOAT tools for Smolagents.")

except Exception as e:
    print(f"Error during initialization: {e}")
    exit(1)

# --- Define Smolagents Agent ---
print(f"Initializing Smolagents agent with model: GPT-4o...")
model = OpenAIServerModel(
    model_id="gpt-4o",
)

agent = ToolCallingAgent(
    tools=goat_smolagents_tools,
    model=model,
    add_base_tools=False
)

# Set custom system prompt after initialization
agent.prompt_templates["system_prompt"] = (
    "You are an expert analyst focused on the Solana blockchain and its SPL token ecosystem. "
    "You have access to specialized tools that can query SPL token balances and potentially other relevant information directly from the blockchain. "
    "Your task is to understand the user's question, use the appropriate tool(s) if necessary, and provide a clear, concise answer based *only* on the information retrieved from the tools. "
    "If the tools cannot provide the information needed to answer the question, clearly state that."
)

# --- Interactive Loop ---
def run_interactive_loop():
    print("\n--- Solana SPL Token Analyst (Smolagents) ---")
    print("Ask questions about SPL tokens (using configured wallet and network). Type 'quit' to exit.")
    while True:
        try:
            user_query = input("\nYour question: ")
            if user_query.lower() == "quit":
                print("Exiting...")
                break
            if not user_query.strip():
                continue

            print("\nProcessing your request with Smolagents...")
            # Run the agent with the user's question
            result = agent.run(user_query)

            print("\n✅ --- Agent Finished ---")
            print("Final Answer:")
            print(result)
            print("--------------------\n")

        except Exception as e:
            print(f"\n❌ An error occurred during agent execution: {e}")
        except KeyboardInterrupt:
            print("\nExiting...")
            break

if __name__ == "__main__":
    run_interactive_loop()
