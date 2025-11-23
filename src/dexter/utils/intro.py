import sys

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
    print("Ask me any questions. Type 'exit' or 'quit' to end.")
    print()

    # Prompt for which provider to use and set environment variables accordingly.
    # If keys are already present in the environment, do nothing.
    import os

    try:
        print(f"{LIGHT_BLUE}{BOLD}Select LLM provider to use:{RESET}")
        print("  1) OpenAI (OPENAI_API_KEY)")
        print("  2) OpenRouter (OPENROUTER_API_KEY + OPENROUTER_BASE_URL)")
        print()
        choice = None
        while choice not in ("1", "2"):
            choice = input("Enter 1 or 2 (default 1): ").strip() or "1"

        if choice == "1":
            if os.environ["OPENAI_API_KEY"]:
                os.environ["DEXTER_API_KEY_TYPE"] = "OPENAI"
                print("OPENAI_API_KEY is set for this session.")
            else:
                print("OPENAI_API_KEY NOT found in environment variables.")
        elif choice == "2":
            if os.environ.get("OPENROUTER_API_KEY") is None or os.environ.get("OPENROUTER_BASE_URL") is None:
                print("OPENROUTER_API_KEY or OPENROUTER_BASE_URL NOT found in environment variables.")
            else:
                os.environ["DEXTER_API_KEY_TYPE"] = "OPEROUTER"
                print("OPENROUTER_API_KEY is set for this session.")
        print()
    except (KeyboardInterrupt, EOFError):
        # Don't crash if user aborts prompt; proceed with whatever env is available
        print("\nGoodbye!")
        sys.exit(0)

