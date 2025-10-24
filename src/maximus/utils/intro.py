import os

def get_version():
    """Get version from pyproject.toml"""
    return "0.1.0"

def check_api_status():
    """Check if API keys are configured."""
    openai_key = os.getenv("OPENAI_API_KEY")
    coingecko_key = os.getenv("COINGECKO_API_KEY")
    
    statuses = []
    
    # Check OpenAI API key
    if openai_key and len(openai_key) > 0:
        statuses.append(("OpenAI API", "✓", "\033[92m"))  # Green
    else:
        statuses.append(("OpenAI API", "✗", "\033[91m"))  # Red
    
    # Check CoinGecko API key
    if coingecko_key and len(coingecko_key) > 0:
        statuses.append(("CoinGecko API", "✓", "\033[92m"))  # Green
    else:
        statuses.append(("CoinGecko API", "✗", "\033[91m"))  # Red
    
    return statuses

def print_intro(session_id: str = None):
    """Display the welcome screen with compact logo."""
    # ANSI color codes
    LIGHT_ORANGE = "\033[38;5;215m"
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    GREEN = "\033[92m"
    
    # Clear screen effect with some spacing
    print("\n" * 2)
    
    version = get_version()
    
    # Logo options
    # Icon logo (compact)
    icon_logo = f"""{BOLD}{LIGHT_ORANGE} █▄█▄█{RESET}  {BOLD}MAXIMUS{RESET} {DIM}v{version}{RESET}
{BOLD}{LIGHT_ORANGE} █ ▄ █{RESET}  {DIM}Autonomous agent for onchain asset analysis and transaction execution{RESET}
{BOLD}{LIGHT_ORANGE}     {RESET}   """
    
    # Full logo (with full text)
#     logo = f"""{BOLD}{LIGHT_ORANGE} █▄█▄█ ▄▀█ ▀▄▀ █ █▄█▄█ █ █ ▄▀█{RESET}  {BOLD}MAXIMUS{RESET} {DIM}v{version}{RESET}
# {BOLD}{LIGHT_ORANGE} █ ▄ █ █▀█ █░█ █ █ ▄ █ █▄█ ▄▄█{RESET}  {DIM}Autonomous agent for onchain asset analysis and transaction execution{RESET}"""
    
    print(icon_logo)
    print()
    
    # Session info
    if session_id:
        print(f"{GREEN}✓{RESET} {DIM}Session initialized (ID: {session_id[:8]}){RESET}")
    
    # API connection status
    api_statuses = check_api_status()
    for api_name, symbol, color in api_statuses:
        print(f"{color}{symbol}{RESET} {DIM}{api_name}{RESET}")
    
    print()

