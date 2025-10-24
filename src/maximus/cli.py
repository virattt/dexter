import uuid
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from maximus.agent import Agent
from maximus.tools.memory import clear_memories
from maximus.utils.intro import print_intro
from prompt_toolkit import PromptSession
from prompt_toolkit.history import InMemoryHistory

def main():
    print_intro()
    
    # Generate a unique session ID for this CLI session
    session_id = str(uuid.uuid4())
    print(f"💾 Session initialized with memory (ID: {session_id[:8]}...)\n")
    agent = Agent(session_id=session_id)

    # Create a prompt session
    session = PromptSession(history=InMemoryHistory())

    while True:
        try:
          # Prompt the user for input
          query = session.prompt(">> ")
          
          # Handle special commands
          if query.lower() in ["exit", "quit"]:
              print("Goodbye!")
              # Clear memories on exit (silently, with error handling)
              if session_id:
                  try:
                      clear_memories(session_id, silent=True)
                  except Exception:
                      # Silently ignore errors during cleanup
                      pass
              break
          
          if query.lower() in ["/clear-mem", "/clear-memory"]:
              clear_memories(session_id)
              continue
          
          if query:
              # Run the agent
              agent.run(query)
        except (KeyboardInterrupt, EOFError):
            # Clear memories on exit (silently, with error handling)
            print("\nGoodbye!")
            if session_id:
                try:
                    clear_memories(session_id, silent=True)
                except Exception:
                    # Silently ignore errors during cleanup on exit
                    pass
            break


if __name__ == "__main__":
    main()
