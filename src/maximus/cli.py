import uuid
import os
import re
import shutil
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from maximus.agent import Agent
from maximus.tools.memory import clear_memories
from maximus.utils.intro import print_intro
from maximus.utils.ui import Colors
from maximus.utils.command_palette import CommandPalette
from prompt_toolkit import PromptSession
from prompt_toolkit.history import InMemoryHistory
from prompt_toolkit.key_binding import KeyBindings
from prompt_toolkit.keys import Keys

def get_terminal_width():
    """Get the current terminal width."""
    return shutil.get_terminal_size().columns

def print_separator_line():
    """Print a full-width dotted line separator in light orange."""
    width = get_terminal_width()
    print(f"{Colors.LIGHT_ORANGE}{'·' * width}{Colors.ENDC}")

def execute_command(command_name: str, session_id: str) -> tuple[bool, str]:
    """
    Execute a command and return (should_exit, message).
    
    Returns:
        tuple: (should_exit: bool, message: str or None)
    """
    if command_name == "/clear-mem":
        clear_memories(session_id)
        return False, None
    elif command_name == "/config":
        return False, f"{Colors.DIM}Configuration panel (coming soon){Colors.ENDC}"
    elif command_name == "/cost":
        return False, f"{Colors.DIM}Session cost tracking (coming soon){Colors.ENDC}"
    elif command_name == "/exit":
        return True, "Goodbye!"
    return False, None

def main():
    # Generate a unique session ID for this CLI session
    session_id = str(uuid.uuid4())
    
    # Print intro with session info
    print_intro(session_id)
    
    agent = Agent(session_id=session_id)
    
    # Initialize command palette
    palette = CommandPalette()
    
    # Track if we should skip normal query processing
    command_executed = False
    
    # Create a prompt session without custom key bindings
    session = PromptSession(history=InMemoryHistory())

    while True:
        try:
          command_executed = False
          
          # Print command palette
          print(palette.render())
          print()  # Add spacing after palette
          
          # Print separator line above input
          print_separator_line()
          
          # Prompt the user for input
          query = session.prompt(">> ")
          
          # Print separator line below input
          print_separator_line()
          print()  # Add spacing after input area
          
          # Check if user typed "/" to expand palette
          if query == "/":
              if palette.is_expanded:
                  # Collapse if already expanded
                  palette.collapse()
              else:
                  # Expand the palette
                  palette.expand()
              continue
          
          # Handle command selection when palette is expanded
          if palette.is_expanded:
              # Check if user entered a number
              if query.isdigit():
                  number = int(query)
                  selected_cmd = palette.get_command_by_number(number)
                  if selected_cmd:
                      should_exit, message = execute_command(selected_cmd.name, session_id)
                      palette.collapse()
                      command_executed = True
                      
                      if message:
                          print(message)
                          print()
                      
                      if should_exit:
                          try:
                              clear_memories(session_id, silent=True)
                          except Exception:
                              pass
                          break
                      
                      continue
                  else:
                      print(f"{Colors.DIM}Invalid command number{Colors.ENDC}")
                      print()
                      continue
              
              # Check if user entered a command name
              elif query.startswith("/"):
                  selected_cmd = palette.get_command_by_name(query)
                  if selected_cmd:
                      should_exit, message = execute_command(selected_cmd.name, session_id)
                      palette.collapse()
                      command_executed = True
                      
                      if message:
                          print(message)
                          print()
                      
                      if should_exit:
                          try:
                              clear_memories(session_id, silent=True)
                          except Exception:
                              pass
                          break
                      
                      continue
                  # If not found, treat as regular command (backward compatibility)
                  else:
                      palette.collapse()
              
              # Any other text collapses palette and processes as normal query
              else:
                  palette.collapse()

          # Handle exit commands
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
          
          # Handle clear memory command
          if query.lower() in ["/clear-mem", "/clear-memory"]:
              clear_memories(session_id)
              continue
          
          # Run the agent if there's a query
          if query and not command_executed:
              # Run the agent
              agent.run(query)
              # After the agent completes, add spacing before next input
              print()
              
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
