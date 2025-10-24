def print_intro():
    """Display the welcome screen with ASCII art."""
    # ANSI color codes
    LIGHT_ORANGE = "\033[38;5;215m"
    RESET = "\033[0m"
    BOLD = "\033[1m"
    
    # Clear screen effect with some spacing
    print("\n" * 2)
    
    # Welcome box with light orange border
    box_width = 50
    welcome_text = "Welcome to Maximus"
    padding = (box_width - len(welcome_text) - 2) // 2
    
    print(f"{LIGHT_ORANGE}{'═' * box_width}{RESET}")
    print(f"{LIGHT_ORANGE}║{' ' * padding}{BOLD}{welcome_text}{RESET}{LIGHT_ORANGE}{' ' * (box_width - len(welcome_text) - padding - 2)}║{RESET}")
    print(f"{LIGHT_ORANGE}{'═' * box_width}{RESET}")
    print()
    
    # ASCII art for MAXIMUS in block letters (financial terminal style)
    maximus_art = f"""{BOLD}{LIGHT_ORANGE}
███╗   ███╗ █████╗ ██╗  ██╗██╗███╗   ███╗██╗   ██╗███████╗
████╗ ████║██╔══██╗╚██╗██╔╝██║████╗ ████║██║   ██║██╔════╝
██╔████╔██║███████║ ╚███╔╝ ██║██╔████╔██║██║   ██║███████╗
██║╚██╔╝██║██╔══██║ ██╔██╗ ██║██║╚██╔╝██║██║   ██║╚════██║
██║ ╚═╝ ██║██║  ██║██╔╝ ██╗██║██║ ╚═╝ ██║╚██████╔╝███████║
╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝     ╚═╝ ╚═════╝ ╚══════╝
{RESET}"""
    
    print(maximus_art)
    print()
    print("Your AI assistant for cryptocurrency research and analysis.")
    print("Ask me any questions. Type 'exit' or 'quit' to end.")
    print()

