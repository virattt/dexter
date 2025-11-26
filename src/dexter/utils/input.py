from prompt_toolkit import PromptSession
from prompt_toolkit.history import InMemoryHistory
from prompt_toolkit.formatted_text import HTML
from prompt_toolkit.styles import Style


# Custom style for the input component
INPUT_STYLE = Style.from_dict({
    # Prompt styling
    "prompt": "#58A6FF bold",
})


def create_input_session() -> PromptSession:
    """Create and return a configured PromptSession."""
    return PromptSession(
        history=InMemoryHistory(),
        style=INPUT_STYLE,
    )


def prompt_user(session: PromptSession) -> str | None:
    """
    Prompt the user for input using the styled session.
    
    Returns:
        The user's input string, or None if the user wants to exit.
    
    Raises:
        KeyboardInterrupt: If the user presses Ctrl+C
        EOFError: If the user presses Ctrl+D
    """
    query = session.prompt(
        HTML('<prompt>&gt; </prompt>'),
    )
    
    if query.lower() in ["exit", "quit"]:
        return None
    
    return query