def print_intro():
    """Display the welcome screen with ASCII art."""
    # ANSI color codes
    LIGHT_ORANGE = "\033[38;2;239;159;118m"
    RESET = "\033[0m"
    BOLD = "\033[1m"
    
    # Clear screen effect with some spacing
    print("\n" * 2)
    
    # Welcome box with light orange border
    box_width = 50
    welcome_text = "Welcome to Dexter-Free"
    padding = (box_width - len(welcome_text) - 2) // 2
    
    print(f"{LIGHT_ORANGE}{'═' * box_width}{RESET}")
    print(f"{LIGHT_ORANGE}║{' ' * padding}{BOLD}{welcome_text}{RESET}{LIGHT_ORANGE}{' ' * (box_width - len(welcome_text) - padding - 2)}║{RESET}")
    print(f"{LIGHT_ORANGE}{'═' * box_width}{RESET}")
    print()
    
    # ASCII art for DEXTER-FREE in block letters (financial terminal style)
    dexter_art = f"""{BOLD}{LIGHT_ORANGE}
██████╗   ███████╗  ██╗  ██╗  ████████╗  ███████╗  ██████╗              ███████╗  ██████╗   ███████╗  ███████╗  
██╔══██╗  ██╔════╝  ╚██╗██╔╝  ╚══██╔══╝  ██╔════╝  ██╔══██╗             ██╔════╝  ██╔══██╗  ██╔════╝  ██╔════╝  
██║  ██║  █████╗     ╚███╔╝      ██║     █████╗    ██████╔╝  ████████╗  █████╗    ██████╔╝  █████╗    █████╗    
██║  ██║  ██╔══╝     ██╔██╗      ██║     ██╔══╝    ██╔══██╗  ╚═══════╝  ██╔══╝    ██╔══██╗  ██╔══╝    ██╔══╝    
██████╔╝  ███████╗  ██╔╝ ██╗     ██║     ███████╗  ██║  ██║             ██║       ██║  ██║  ███████╗  ███████╗  
╚═════╝   ╚══════╝  ╚═╝  ╚═╝     ╚═╝     ╚══════╝  ╚═╝  ╚═╝             ╚═╝       ╚═╝  ╚═╝  ╚══════╝  ╚══════╝  
{RESET}"""
    
    print(dexter_art)
    print()
    print("Your AI assistant for financial analysis.")
    print("Ask me any questions. Type 'exit' or 'quit' to end.")
    print()
