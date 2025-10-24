import re
import shutil
from typing import List, Tuple, Optional
from maximus.utils.ui import Colors


class Command:
    """Represents a command with its metadata."""
    
    def __init__(self, name: str, aliases: List[str], description: str):
        self.name = name
        self.aliases = aliases
        self.description = description
    
    def matches_filter(self, filter_text: str) -> bool:
        """Check if command matches the filter text."""
        if not filter_text:
            return True
        
        filter_lower = filter_text.lower()
        # Match against command name, aliases, and description
        if filter_lower in self.name.lower():
            return True
        for alias in self.aliases:
            if filter_lower in alias.lower():
                return True
        if filter_lower in self.description.lower():
            return True
        return False


class CommandPalette:
    """Interactive command palette for MAXIMUS."""
    
    def __init__(self):
        self.is_expanded = False
        self.selected_index = 0
        self.filter_text = ""
        
        # Define available commands
        self.commands = [
            Command("/clear", ["reset"], "Clear conversation memory"),
            Command("/config", ["settings"], "Open configuration settings"),
            Command("/cost", ["usage", "billing"], "Show session cost and duration"),
            Command("/exit", ["quit"], "Exit MAXIMUS"),
        ]
    
    def get_terminal_width(self) -> int:
        """Get current terminal width."""
        return shutil.get_terminal_size().columns
    
    def get_filtered_commands(self) -> List[Command]:
        """Get list of commands that match the current filter."""
        return [cmd for cmd in self.commands if cmd.matches_filter(self.filter_text)]
    
    def expand(self):
        """Expand the palette and reset state."""
        self.is_expanded = True
        self.selected_index = 0
        self.filter_text = ""
    
    def collapse(self):
        """Collapse the palette."""
        self.is_expanded = False
        self.selected_index = 0
        self.filter_text = ""
    
    def navigate_up(self):
        """Move selection up."""
        if self.is_expanded:
            filtered = self.get_filtered_commands()
            if filtered:
                self.selected_index = (self.selected_index - 1) % len(filtered)
    
    def navigate_down(self):
        """Move selection down."""
        if self.is_expanded:
            filtered = self.get_filtered_commands()
            if filtered:
                self.selected_index = (self.selected_index + 1) % len(filtered)
    
    def add_to_filter(self, char: str):
        """Add character to filter text."""
        self.filter_text += char
        # Reset selection to first item when filter changes
        self.selected_index = 0
    
    def remove_from_filter(self):
        """Remove last character from filter text."""
        if self.filter_text:
            self.filter_text = self.filter_text[:-1]
            self.selected_index = 0
    
    def get_selected_command(self) -> Optional[Command]:
        """Get the currently selected command."""
        filtered = self.get_filtered_commands()
        if filtered and 0 <= self.selected_index < len(filtered):
            return filtered[self.selected_index]
        return None
    
    def render_collapsed(self) -> str:
        """Render the collapsed state."""
        width = self.get_terminal_width()
        
        lines = []
        # Top border
        lines.append(f"{Colors.DIM}┌{'─' * (width - 2)}┐{Colors.ENDC}")
        
        # Content
        text = f"  {Colors.DIM}Type '/' to see all commands{Colors.ENDC}"
        text_length = len(re.sub(r'\033\[[0-9;]+m', '', text))
        padding = width - text_length - 4
        lines.append(f"{Colors.DIM}│{Colors.ENDC}{text}{' ' * padding}{Colors.DIM}│{Colors.ENDC}")
        
        # Bottom border
        lines.append(f"{Colors.DIM}└{'─' * (width - 2)}┘{Colors.ENDC}")
        
        return '\n'.join(lines)
    
    def render_expanded(self) -> str:
        """Render the expanded state with commands."""
        width = self.get_terminal_width()
        filtered = self.get_filtered_commands()
        
        lines = []
        # Top border
        lines.append(f"{Colors.DIM}┌{'─' * (width - 2)}┐{Colors.ENDC}")
        
        # Header text
        header = f"  {Colors.BOLD}Available Commands{Colors.ENDC} {Colors.DIM}(type number or command name){Colors.ENDC}"
        text_length = len(re.sub(r'\033\[[0-9;]+m', '', header))
        padding = width - text_length - 4
        lines.append(f"{Colors.DIM}│{Colors.ENDC}{header}{' ' * padding}{Colors.DIM}│{Colors.ENDC}")
        
        # Separator
        lines.append(f"{Colors.DIM}├{'─' * (width - 2)}┤{Colors.ENDC}")
        
        # Commands list with numbers
        if not filtered:
            text = f"  {Colors.DIM}No commands found{Colors.ENDC}"
            text_length = len(re.sub(r'\033\[[0-9;]+m', '', text))
            padding = width - text_length - 4
            lines.append(f"{Colors.DIM}│{Colors.ENDC}{text}{' ' * padding}{Colors.DIM}│{Colors.ENDC}")
        else:
            for i, cmd in enumerate(filtered, 1):
                # Format command line with number
                cmd_text = f"  {Colors.LIGHT_ORANGE}{i}.{Colors.ENDC} {Colors.LIGHT_ORANGE}{cmd.name}{Colors.ENDC}"
                desc_text = f"{Colors.DIM}{cmd.description}{Colors.ENDC}"
                
                # Calculate spacing between command and description
                max_cmd_width = 25  # Fixed width for command column
                cmd_text_plain = re.sub(r'\033\[[0-9;]+m', '', cmd_text)
                spacing = max_cmd_width - len(cmd_text_plain)
                
                full_text = f"{cmd_text}{' ' * spacing}{desc_text}"
                
                # Calculate padding to right edge
                text_length = len(re.sub(r'\033\[[0-9;]+m', '', full_text))
                padding = width - text_length - 4
                
                lines.append(f"{Colors.DIM}│{Colors.ENDC}{full_text}{' ' * padding}{Colors.DIM}│{Colors.ENDC}")
        
        # Bottom border
        lines.append(f"{Colors.DIM}└{'─' * (width - 2)}┘{Colors.ENDC}")
        
        return '\n'.join(lines)
    
    def get_command_by_number(self, number: int) -> Optional[Command]:
        """Get command by its display number (1-indexed)."""
        filtered = self.get_filtered_commands()
        if 1 <= number <= len(filtered):
            return filtered[number - 1]
        return None
    
    def get_command_by_name(self, name: str) -> Optional[Command]:
        """Get command by its name or alias."""
        name_lower = name.lower().lstrip('/')
        for cmd in self.commands:
            if cmd.name.lower().lstrip('/') == name_lower:
                return cmd
            for alias in cmd.aliases:
                if alias.lower() == name_lower:
                    return cmd
        return None
    
    def render(self) -> str:
        """Render the palette in its current state."""
        if self.is_expanded:
            return self.render_expanded()
        else:
            return self.render_collapsed()
    
    def render_as_formatted_text(self):
        """Render palette as formatted text for prompt_toolkit Application."""
        from prompt_toolkit.formatted_text import FormattedText
        
        result = []
        
        if self.is_expanded:
            # Commands only, no borders or headers
            filtered = self.get_filtered_commands()
            if not filtered:
                result.append(('class:dim', '  No commands found\n'))
            else:
                for i, cmd in enumerate(filtered):
                    is_selected = (i == self.selected_index)
                    
                    cmd_text = f"  {cmd.name}"
                    desc_text = cmd.description
                    max_cmd_width = 20
                    spacing = max_cmd_width - len(cmd_text)
                    
                    if is_selected:
                        # Selected: orange text for entire row, no background
                        result.append(('class:selected', cmd_text + ' ' * spacing + desc_text + '\n'))
                    else:
                        result.append(('class:dim', cmd_text + ' ' * spacing + desc_text + '\n'))
            
            # Add padding at the bottom
            result.append(('', '\n'))
        else:
            # Collapsed state - simple text with padding
            result.append(('class:dim', " Type '/' to see all commands\n"))
            result.append(('', '\n'))
        
        return FormattedText(result)
