from dotenv import load_dotenv
import os
import sys

# Load environment variables BEFORE importing any dexter modules
load_dotenv()

# Validate required environment variables
required_vars = ["OPENAI_API_KEY", "FINANCIAL_DATASETS_API_KEY"]
missing_vars = [var for var in required_vars if not os.getenv(var)]

if missing_vars:
    print(f"Error: Missing required environment variables: {', '.join(missing_vars)}")
    print("Please set these in your .env file or environment variables.")
    sys.exit(1)

from dexter.agent import Agent
from dexter.utils.intro import print_intro
from prompt_toolkit import PromptSession
from prompt_toolkit.history import InMemoryHistory

def main():
    try:
        print_intro()
        agent = Agent()

        # Create a prompt session with history support
        session = PromptSession(history=InMemoryHistory())

        while True:
            try:
                query = session.prompt(">> ")
                if query.lower() in ["exit", "quit"]:
                    print("Goodbye!")
                    break
                if query.strip():  # Check for non-empty query
                    agent.run(query)
            except (KeyboardInterrupt, EOFError):
                print("\nGoodbye!")
                break
            except Exception as e:
                print(f"Error processing query: {e}")
                print("Please try again or type 'exit' to quit.")
    except Exception as e:
        print(f"Failed to initialize Dexter: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
