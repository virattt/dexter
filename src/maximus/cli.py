import uuid
import os
import shutil
import threading
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from maximus.agent import Agent
from maximus.tools.memory import clear_memories
from maximus.utils.intro import print_intro
from maximus.utils.ui import Colors
from maximus.utils.command_palette import CommandPalette

from prompt_toolkit.application import Application
from prompt_toolkit.buffer import Buffer
from prompt_toolkit.layout import Layout, HSplit, Window
from prompt_toolkit.layout.controls import BufferControl, FormattedTextControl
from prompt_toolkit.key_binding import KeyBindings
from prompt_toolkit.keys import Keys
from prompt_toolkit.styles import Style
from prompt_toolkit.formatted_text import FormattedText


def get_terminal_width():
    """Get current terminal width."""
    return shutil.get_terminal_size().columns


class AppState:
    """Application state management."""
    
    def __init__(self, session_id: str):
        self.palette = CommandPalette()
        self.session_id = session_id
        self.agent = Agent(session_id=session_id)
        self.should_exit = False
        self.processing = False
        self.pending_query = None
        self.command_message = None


def create_separator_line():
    """Create a separator line as formatted text."""
    width = get_terminal_width()
    return FormattedText([('class:separator', '·' * width + '\n')])


def execute_command(command_name: str, state: AppState) -> str:
    """
    Execute a command and return message.
    
    Returns:
        str: Message to display (or None)
    """
    if command_name == "/clear":
        clear_memories(state.session_id)
        return "Memory cleared"
    elif command_name == "/config":
        return "Configuration panel (coming soon)"
    elif command_name == "/cost":
        return "Session cost tracking (coming soon)"
    elif command_name == "/exit":
        state.should_exit = True
        return "Goodbye!"
    return None


def create_application(state: AppState):
    """Create and configure the prompt_toolkit Application."""
    
    # Create input buffer
    input_buffer = Buffer(multiline=False)
    
    # Create key bindings
    kb = KeyBindings()
    
    # Track buffer changes for palette interaction
    def on_text_changed(_):
        """Monitor input buffer changes."""
        text = input_buffer.text
        
        # Expand palette when "/" is typed
        if text.startswith('/') and not state.palette.is_expanded:
            state.palette.expand()
            state.palette.filter_text = text[1:]  # Everything after /
            state.palette.selected_index = 0
        # Update filter when palette is expanded
        elif state.palette.is_expanded and text.startswith('/'):
            state.palette.filter_text = text[1:]  # Everything after /
            state.palette.selected_index = 0
        # Collapse palette when "/" is deleted
        elif state.palette.is_expanded and not text.startswith('/'):
            state.palette.collapse()
    
    input_buffer.on_text_changed += on_text_changed
    
    @kb.add(Keys.Up)
    def handle_up(event):
        """Navigate up in command palette."""
        if state.palette.is_expanded:
            state.palette.navigate_up()
    
    @kb.add(Keys.Down)
    def handle_down(event):
        """Navigate down in command palette."""
        if state.palette.is_expanded:
            state.palette.navigate_down()
    
    @kb.add(Keys.Escape)
    def handle_escape(event):
        """Collapse palette on Escape."""
        if state.palette.is_expanded:
            state.palette.collapse()
            input_buffer.text = ""
    
    @kb.add(Keys.ControlC)
    def handle_ctrl_c(event):
        """Exit gracefully on Ctrl+C."""
        state.should_exit = True
        event.app.exit()
    
    @kb.add(Keys.Enter)
    def handle_enter(event):
        """Handle Enter key - execute command or query."""
        text = input_buffer.text.strip()
        
        if state.palette.is_expanded:
            # Execute selected command
            selected_cmd = state.palette.get_selected_command()
            if selected_cmd:
                # Collapse palette and clear input
                state.palette.collapse()
                input_buffer.text = ""
                
                # Execute the command
                message = execute_command(selected_cmd.name, state)
                
                # Exit app to restart and show message
                if message:
                    state.command_message = message
                
                event.app.exit()
                return
        else:
            # Handle regular query
            if text:
                # Handle exit commands
                if text.lower() in ["exit", "quit"]:
                    state.should_exit = True
                    state.command_message = "Goodbye!"
                    try:
                        clear_memories(state.session_id, silent=True)
                    except Exception:
                        pass
                    event.app.exit()
                    return
                
                # Handle legacy commands
                if text.lower() in ["/clear", "/clear-memory"]:
                    input_buffer.text = ""
                    state.command_message = "Memory cleared"
                    clear_memories(state.session_id)
                    event.app.exit()
                    return
                
                # Store the query and exit to process with agent
                input_buffer.text = ""
                state.pending_query = text
                event.app.exit()
    
    # Define styles
    style = Style.from_dict({
        'selected': '#ffaf5f',           # Light orange text only, no background (matches logo)
        'orange': '#ffaf5f',             # Light orange (matches logo)
        'dim': '#666666',                # Dim gray
        'separator': '#666666',          # Dim separators
        'bold': 'bold',
        'prompt': '#ffffff',             # White for >> prompt
    })
    
    # Create layout
    def get_palette_content():
        """Dynamic content for palette area."""
        return state.palette.render_as_formatted_text()
    
    layout = Layout(
        HSplit([
            # Top separator
            Window(
                content=FormattedTextControl(create_separator_line),
                height=1,
            ),
            # Input area with prompt
            Window(
                content=BufferControl(
                    buffer=input_buffer,
                    focusable=True,
                ),
                height=1,
                get_line_prefix=lambda line_number, wrap_count: [('class:prompt', '>> ')],
            ),
            # Bottom separator
            Window(
                content=FormattedTextControl(create_separator_line),
                height=1,
            ),
            # Command palette area (dynamic) - now below input
            Window(
                content=FormattedTextControl(
                    get_palette_content,
                    focusable=False,
                ),
                height=lambda: 2 if not state.palette.is_expanded else len(state.palette.get_filtered_commands()) + 1,
            ),
        ])
    )
    
    # Create application
    app = Application(
        layout=layout,
        key_bindings=kb,
        style=style,
        full_screen=False,
        mouse_support=False,
    )
    
    return app, input_buffer


def main():
    # Generate a unique session ID for this CLI session
    session_id = str(uuid.uuid4())
    
    # Print intro with session info
    print_intro(session_id)
    
    # Initialize state
    state = AppState(session_id)
    
    # Main interaction loop
    while not state.should_exit:
        try:
            # Create and run application
            app, input_buffer = create_application(state)
            
            # Run the application
            app.run()
            
            # Handle command messages
            if state.command_message:
                print(f"\n{state.command_message}\n")
                state.command_message = None
                
                # If should exit, break the loop
                if state.should_exit:
                    break
                
                # Otherwise continue to next iteration
                continue
            
            # Check if we have a query to process
            if state.pending_query:
                query = state.pending_query
                state.pending_query = None
                
                # Run the agent (it will print the user query itself)
                try:
                    state.agent.run(query)
                    print()
                except Exception as e:
                    print(f"{Colors.RED}Error:{Colors.ENDC} {str(e)}\n")
        
        except (KeyboardInterrupt, EOFError):
            # Handle Ctrl+C gracefully
            print("\nGoodbye!")
            try:
                clear_memories(session_id, silent=True)
            except Exception:
                pass
            break
    
    # Clean up on exit
    if not state.should_exit:
        try:
            clear_memories(session_id, silent=True)
        except Exception:
            pass


def print_separator_line():
    """Print a full-width dotted line separator in light orange."""
    width = get_terminal_width()
    print(f"{Colors.LIGHT_ORANGE}{'·' * width}{Colors.ENDC}")


if __name__ == "__main__":
    main()
