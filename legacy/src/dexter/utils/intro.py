def print_intro():
    """Display the welcome screen with ASCII art."""
    # ANSI color codes
    LIGHT_BLUE = "\033[94m"
    RESET = "\033[0m"
    BOLD = "\033[1m"
    
    # Clear screen effect with some spacing
    print("\n" * 2)
    
    # Welcome box with light blue border
    box_width = 50
    welcome_text = "Welcome to Dexter"
    padding = (box_width - len(welcome_text) - 2) // 2
    
    print(f"{LIGHT_BLUE}{'═' * box_width}{RESET}")
    print(f"{LIGHT_BLUE}║{' ' * padding}{BOLD}{welcome_text}{RESET}{LIGHT_BLUE}{' ' * (box_width - len(welcome_text) - padding - 2)}║{RESET}")
    print(f"{LIGHT_BLUE}{'═' * box_width}{RESET}")
    print()
    
    # ASCII art for DEXTER in block letters (financial terminal style)
    dexter_art = f"""{BOLD}{LIGHT_BLUE}
██████╗ ███████╗██╗  ██╗████████╗███████╗██████╗ 
██╔══██╗██╔════╝╚██╗██╔╝╚══██╔══╝██╔════╝██╔══██╗
██║  ██║█████╗   ╚███╔╝    ██║   █████╗  ██████╔╝
██║  ██║██╔══╝   ██╔██╗    ██║   ██╔══╝  ██╔══██╗
██████╔╝███████╗██╔╝ ██╗   ██║   ███████╗██║  ██║
╚═════╝ ╚══════╝╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝
{RESET}"""
    
    print(dexter_art)
    print()
    print("Your AI assistant for financial analysis.")
    print("Ask me any question. Press Ctrl+C to quit. Type /model to change the model.")
    print()

