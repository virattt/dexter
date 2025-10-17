import sys
import time
import threading
from contextlib import contextmanager
from typing import Optional, Callable
from functools import wraps


class Colors:
    BLUE = "\033[94m"
    CYAN = "\033[96m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    MAGENTA = "\033[95m"
    ENDC = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    WHITE = "\033[97m"
    LIGHT_BLUE = "\033[94m"  # Same as DEXTER ASCII art


class Spinner:
    """An animated spinner that runs in a separate thread."""
    
    FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
    
    def __init__(self, message: str = "", color: str = Colors.CYAN):
        self.message = message
        self.color = color
        self.running = False
        self.thread: Optional[threading.Thread] = None
        
    def _animate(self):
        """Animation loop that runs in a separate thread."""
        idx = 0
        while self.running:
            frame = self.FRAMES[idx % len(self.FRAMES)]
            sys.stdout.write(f"\r{self.color}{frame}{Colors.ENDC} {self.message}")
            sys.stdout.flush()
            time.sleep(0.08)
            idx += 1
    
    def start(self):
        """Start the spinner animation."""
        if not self.running:
            self.running = True
            self.thread = threading.Thread(target=self._animate, daemon=True)
            self.thread.start()
    
    def stop(self, final_message: str = "", symbol: str = "✓", symbol_color: str = Colors.GREEN):
        """Stop the spinner and optionally show a completion message."""
        if self.running:
            self.running = False
            if self.thread:
                self.thread.join()
            # Clear the line
            sys.stdout.write("\r" + " " * (len(self.message) + 10) + "\r")
            if final_message:
                print(f"{symbol_color}{symbol}{Colors.ENDC} {final_message}")
            sys.stdout.flush()
    
    def update_message(self, message: str):
        """Update the spinner message."""
        self.message = message


def show_progress(message: str, success_message: str = ""):
    """Decorator to show progress spinner while a function executes."""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            spinner = Spinner(message, color=Colors.CYAN)
            spinner.start()
            try:
                result = func(*args, **kwargs)
                spinner.stop(success_message or message.replace("...", " ✓"), symbol="✓", symbol_color=Colors.GREEN)
                return result
            except Exception as e:
                spinner.stop(f"Failed: {str(e)}", symbol="✗", symbol_color=Colors.RED)
                raise
        return wrapper
    return decorator


class UI:
    """Interactive UI for displaying agent progress and results."""
    
    def __init__(self):
        self.current_spinner: Optional[Spinner] = None
        
    @contextmanager
    def progress(self, message: str, success_message: str = ""):
        """Context manager for showing progress with a spinner."""
        spinner = Spinner(message, color=Colors.CYAN)
        self.current_spinner = spinner
        spinner.start()
        try:
            yield spinner
            spinner.stop(success_message or message.replace("...", " ✓"), symbol="✓", symbol_color=Colors.GREEN)
        except Exception as e:
            spinner.stop(f"Failed: {str(e)}", symbol="✗", symbol_color=Colors.RED)
            raise
        finally:
            self.current_spinner = None
    
    def print_header(self, text: str):
        """Print a section header."""
        print(f"\n{Colors.BOLD}{Colors.BLUE}╭─ {text}{Colors.ENDC}")
    
    def print_user_query(self, query: str):
        """Print the user's query in the same style as DEXTER ASCII art."""
        print(f"\n{Colors.BOLD}{Colors.LIGHT_BLUE}You: {query}{Colors.ENDC}\n")
    
    def print_task_list(self, tasks):
        """Print a clean list of planned tasks."""
        if not tasks:
            return
        self.print_header("Planned Tasks")
        for i, task in enumerate(tasks):
            status = "+"
            color = Colors.DIM
            desc = task.get('description', task)
            print(f"{Colors.BLUE}│{Colors.ENDC} {color}{status}{Colors.ENDC} {desc}")
        print(f"{Colors.BLUE}╰{'─' * 50}{Colors.ENDC}\n")
    
    def print_task_start(self, task_desc: str):
        """Print when starting a task."""
        print(f"\n{Colors.BOLD}{Colors.CYAN}▶ Task:{Colors.ENDC} {task_desc}")
    
    def print_task_done(self, task_desc: str):
        """Print when a task is completed."""
        print(f"{Colors.GREEN}  ✓ Completed{Colors.ENDC} {Colors.DIM}│ {task_desc}{Colors.ENDC}")
    
    def print_tool_run(self, tool_name: str, args: str = ""):
        """Print when a tool is executed."""
        args_display = f" {Colors.DIM}({args[:50]}...){Colors.ENDC}" if args and len(args) > 0 else ""
        print(f"  {Colors.YELLOW}⚡{Colors.ENDC} {tool_name}{args_display}")
    
    def print_answer(self, answer: str):
        """Print the final answer in a beautiful box."""
        width = 80
        
        # Top border
        print(f"\n{Colors.BOLD}{Colors.BLUE}╔{'═' * (width - 2)}╗{Colors.ENDC}")
        
        # Title
        title = "ANSWER"
        padding = (width - len(title) - 2) // 2
        print(f"{Colors.BOLD}{Colors.BLUE}║{' ' * padding}{title}{' ' * (width - len(title) - padding - 2)}║{Colors.ENDC}")
        
        # Separator
        print(f"{Colors.BLUE}╠{'═' * (width - 2)}╣{Colors.ENDC}")
        
        # Answer content with proper line wrapping
        print(f"{Colors.BLUE}║{Colors.ENDC}{' ' * (width - 2)}{Colors.BLUE}║{Colors.ENDC}")
        for line in answer.split('\n'):
            if len(line) == 0:
                print(f"{Colors.BLUE}║{Colors.ENDC}{' ' * (width - 2)}{Colors.BLUE}║{Colors.ENDC}")
            else:
                # Word wrap long lines
                words = line.split()
                current_line = ""
                for word in words:
                    if len(current_line) + len(word) + 1 <= width - 6:
                        current_line += word + " "
                    else:
                        if current_line:
                            print(f"{Colors.BLUE}║{Colors.ENDC} {current_line.ljust(width - 4)} {Colors.BLUE}║{Colors.ENDC}")
                        current_line = word + " "
                if current_line:
                    print(f"{Colors.BLUE}║{Colors.ENDC} {current_line.ljust(width - 4)} {Colors.BLUE}║{Colors.ENDC}")
        
        print(f"{Colors.BLUE}║{Colors.ENDC}{' ' * (width - 2)}{Colors.BLUE}║{Colors.ENDC}")
        
        # Bottom border
        print(f"{Colors.BOLD}{Colors.BLUE}╚{'═' * (width - 2)}╝{Colors.ENDC}\n")
    
    def print_info(self, message: str):
        """Print an info message."""
        print(f"{Colors.DIM}{message}{Colors.ENDC}")
    
    def print_error(self, message: str):
        """Print an error message."""
        print(f"{Colors.RED}✗ Error:{Colors.ENDC} {message}")
    
    def print_warning(self, message: str):
        """Print a warning message."""
        print(f"{Colors.YELLOW}⚠ Warning:{Colors.ENDC} {message}")

