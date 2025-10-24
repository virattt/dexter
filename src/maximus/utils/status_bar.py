import sys
import time
import threading
from typing import Optional, Callable
from enum import Enum
from functools import wraps
from maximus.utils.ui import Colors


class StatusPhase(Enum):
    """Phases of agent execution."""
    IDLE = "idle"
    PLANNING = "planning"
    THINKING = "thinking"
    EXECUTING = "executing"
    OPTIMIZING = "optimizing"
    VALIDATING = "validating"
    GENERATING = "generating"
    COMPLETE = "complete"
    ERROR = "error"


class StatusBar:
    """
    A single-line status bar that displays agent progress.
    Updates in place as the agent progresses through different phases.
    """
    
    SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
    
    def __init__(self):
        self.current_phase: StatusPhase = StatusPhase.IDLE
        self.current_message: str = ""
        self.details: str = ""
        self.is_animating: bool = False
        self.animation_thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()
        self._frame_idx = 0
        
    def _get_phase_symbol(self, phase: StatusPhase, is_complete: bool = False) -> tuple[str, str]:
        """Get the symbol and color for a given phase."""
        if is_complete:
            return "✓", Colors.GREEN
        
        phase_map = {
            StatusPhase.IDLE: ("", Colors.DIM),
            StatusPhase.PLANNING: ("", Colors.LIGHT_ORANGE),
            StatusPhase.THINKING: ("", Colors.CYAN),
            StatusPhase.EXECUTING: ("", Colors.YELLOW),
            StatusPhase.OPTIMIZING: ("", Colors.MAGENTA),
            StatusPhase.VALIDATING: ("", Colors.BLUE),
            StatusPhase.GENERATING: ("", Colors.LIGHT_ORANGE),
            StatusPhase.COMPLETE: ("✓", Colors.GREEN),
            StatusPhase.ERROR: ("✗", Colors.RED),
        }
        return phase_map.get(phase, ("", Colors.WHITE))
    
    def _get_spinner_frame(self) -> str:
        """Get the current spinner frame."""
        frame = self.SPINNER_FRAMES[self._frame_idx % len(self.SPINNER_FRAMES)]
        self._frame_idx += 1
        return frame
    
    def _format_status_line(self, use_spinner: bool = True) -> str:
        """Format the complete status line."""
        symbol, color = self._get_phase_symbol(self.current_phase, is_complete=False)
        
        if use_spinner and self.current_phase not in [StatusPhase.IDLE, StatusPhase.COMPLETE, StatusPhase.ERROR]:
            symbol = self._get_spinner_frame()
        
        # Build the status line
        parts = []
        
        if symbol:
            parts.append(f"{color}{symbol}{Colors.ENDC}")
        
        if self.current_message:
            parts.append(f"{color}{self.current_message}{Colors.ENDC}")
        
        if self.details:
            parts.append(f"{Colors.DIM}{self.details}{Colors.ENDC}")
        
        return " ".join(parts)
    
    def _animate(self):
        """Animation loop that updates the status line."""
        while self.is_animating:
            with self._lock:
                line = self._format_status_line(use_spinner=True)
                # Clear line and write new status
                sys.stdout.write(f"\r{' ' * 120}\r{line}")
                sys.stdout.flush()
            time.sleep(0.08)
    
    def start_phase(self, phase: StatusPhase, message: str, details: str = ""):
        """Start a new phase with a message."""
        with self._lock:
            self.current_phase = phase
            self.current_message = message
            self.details = details
            
            # Start animation if not already running
            if not self.is_animating and phase not in [StatusPhase.IDLE, StatusPhase.COMPLETE, StatusPhase.ERROR]:
                self.is_animating = True
                self.animation_thread = threading.Thread(target=self._animate, daemon=True)
                self.animation_thread.start()
    
    def update_details(self, details: str):
        """Update the details portion without changing phase."""
        with self._lock:
            self.details = details
    
    def complete_phase(self, final_message: str = "", show_completion: bool = False):
        """
        Complete the current phase.
        
        Args:
            final_message: Optional message to show on completion
            show_completion: If True, show checkmark and newline. If False, just clear for next phase.
        """
        # Stop animation and capture thread reference inside lock
        with self._lock:
            self.is_animating = False
            thread = self.animation_thread
            self.animation_thread = None
            
            # Capture current message before resetting
            current_msg = self.current_message
            
            # Reset state
            self._frame_idx = 0
            self.current_phase = StatusPhase.IDLE
            self.current_message = ""
            self.details = ""
        
        # Join thread outside the lock to avoid deadlock
        if thread is not None:
            thread.join()
        
        if show_completion:
            # Show completion with checkmark and move to new line
            message = final_message or current_msg
            line = f"{Colors.GREEN}✓{Colors.ENDC} {Colors.GREEN}{message}{Colors.ENDC}"
            sys.stdout.write(f"\r{' ' * 120}\r{line}\n")
            sys.stdout.flush()
        else:
            # Briefly pause to show the current phase before transitioning
            # This ensures users see each step
            time.sleep(0.3)
            
            # Optionally show checkmark briefly, then clear for next phase
            if final_message:
                message = final_message or current_msg
                line = f"{Colors.GREEN}✓{Colors.ENDC} {message}"
                sys.stdout.write(f"\r{' ' * 120}\r{line}")
                sys.stdout.flush()
                time.sleep(0.2)  # Brief pause to show completion
            
            # Clear the line, ready for next status
            sys.stdout.write(f"\r{' ' * 120}\r")
            sys.stdout.flush()
    
    def error_phase(self, error_message: str, show_on_newline: bool = True):
        """
        Mark the current phase as failed.
        
        Args:
            error_message: Error message to display
            show_on_newline: If True, show error on new line. If False, update in place.
        """
        # Stop animation and capture thread reference inside lock
        with self._lock:
            self.is_animating = False
            thread = self.animation_thread
            self.animation_thread = None
            
            # Reset state
            self._frame_idx = 0
            self.current_phase = StatusPhase.IDLE
            self.current_message = ""
            self.details = ""
        
        # Join thread outside the lock to avoid deadlock
        if thread is not None:
            thread.join()
        
        # Show error
        line = f"{Colors.RED}✗{Colors.ENDC} {Colors.RED}{error_message}{Colors.ENDC}"
        
        if show_on_newline:
            # Clear line and write error with newline
            sys.stdout.write(f"\r{' ' * 120}\r{line}\n")
        else:
            # Just update in place
            sys.stdout.write(f"\r{' ' * 120}\r{line}")
        sys.stdout.flush()
    
    def transition_to(self, phase: StatusPhase, message: str, details: str = ""):
        """
        Smoothly transition to a new phase without showing completion of previous phase.
        Just clears the line and starts the new phase.
        """
        # Stop animation and capture thread reference inside lock
        with self._lock:
            self.is_animating = False
            thread = self.animation_thread
            self.animation_thread = None
            
            # Reset state
            self._frame_idx = 0
            self.current_phase = StatusPhase.IDLE
            self.current_message = ""
            self.details = ""
            
            # Clear line
            sys.stdout.write(f"\r{' ' * 120}\r")
            sys.stdout.flush()
        
        # Join thread outside the lock to avoid deadlock
        if thread is not None:
            thread.join()
        
        # Start new phase
        self.start_phase(phase, message, details)
    
    def clear(self):
        """Clear the status bar."""
        # First, stop animation and get thread reference while holding lock
        with self._lock:
            self.is_animating = False
            thread = self.animation_thread
            self.animation_thread = None
        
        # Join thread outside the lock to avoid deadlock
        if thread:
            thread.join()
        
        # Reset state (can be done with or without lock since animation is stopped)
        with self._lock:
            sys.stdout.write(f"\r{' ' * 120}\r")
            sys.stdout.flush()
            
            self.current_phase = StatusPhase.IDLE
            self.current_message = ""
            self.details = ""
            self._frame_idx = 0
    
    def show_static(self, message: str, symbol: str = "", color: str = Colors.WHITE):
        """Show a static message without animation."""
        with self._lock:
            self.is_animating = False
            line = f"{color}{symbol}{Colors.ENDC} {message}" if symbol else message
            sys.stdout.write(f"\r{' ' * 120}\r{line}")
            sys.stdout.flush()


# Global instance for easy access
_global_status_bar: Optional[StatusBar] = None


def get_status_bar() -> StatusBar:
    """Get or create the global status bar instance."""
    global _global_status_bar
    if _global_status_bar is None:
        _global_status_bar = StatusBar()
    return _global_status_bar


def with_status(phase: StatusPhase, message: str, success_message: str = "", details: str = "", show_completion: bool = False):
    """
    Decorator to show status updates while a function executes.
    
    Example:
        @with_status(StatusPhase.EXECUTING, "Executing tool...", "Tool executed")
        def execute_tool():
            # do work
            pass
    
    Args:
        phase: The execution phase
        message: Message to display during execution
        success_message: Optional message on completion
        details: Optional additional details
        show_completion: If True, show checkmark on new line. If False, just transition to next phase.
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            status_bar = get_status_bar()
            status_bar.start_phase(phase, message, details)
            try:
                result = func(*args, **kwargs)
                final_msg = success_message or message.replace("...", "")
                status_bar.complete_phase(final_msg, show_completion=show_completion)
                return result
            except Exception as e:
                status_bar.error_phase(f"Failed: {str(e)}")
                raise
        return wrapper
    return decorator


# Phase-specific convenience decorators
def with_planning(message: str = "Planning tasks...", success_message: str = "Tasks planned"):
    """Decorator for planning phase."""
    return with_status(StatusPhase.PLANNING, message, success_message)


def with_thinking(message: str = "Thinking...", success_message: str = ""):
    """Decorator for thinking phase."""
    return with_status(StatusPhase.THINKING, message, success_message)


def with_executing(message: str, success_message: str = "", details: str = ""):
    """Decorator for executing phase."""
    return with_status(StatusPhase.EXECUTING, message, success_message, details)


def with_optimizing(message: str = "Optimizing...", success_message: str = ""):
    """Decorator for optimizing phase."""
    return with_status(StatusPhase.OPTIMIZING, message, success_message)


def with_validating(message: str = "Validating...", success_message: str = ""):
    """Decorator for validation phase."""
    return with_status(StatusPhase.VALIDATING, message, success_message)


def with_generating(message: str = "Generating answer...", success_message: str = "Answer ready"):
    """Decorator for answer generation phase. Shows completion on new line as final step."""
    return with_status(StatusPhase.GENERATING, message, success_message, show_completion=True)

