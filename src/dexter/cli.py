from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from dexter.utils.intro import print_intro
from prompt_toolkit import PromptSession
from prompt_toolkit.history import InMemoryHistory

def main():
    print_intro()
    # Import Agent after print_intro so that any environment variables set there
    # are available to modules (like dexter.model) that read env vars at import time.
    from dexter.agent import Agent
    agent = Agent()

    # Create a prompt session
    session = PromptSession(history=InMemoryHistory())

    while True:
        try:
          # Prompt the user for input
          query = session.prompt(">> ")
          if query.lower() in ["exit", "quit"]:
              print("Goodbye!")
              break
          if query:
              # Run the agent
              agent.run(query)
        except (KeyboardInterrupt, EOFError):
            print("\nGoodbye!")
            break


if __name__ == "__main__":
    main()
