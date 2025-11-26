from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from dexter.agent import Agent
from dexter.utils.intro import print_intro
from dexter.utils.input import create_input_session, prompt_user
from dexter.utils.model_selector import select_model
from dexter.utils.env import ensure_api_key_for_model
from dexter.utils.config import get_setting, set_setting
from dexter.model import DEFAULT_MODEL


def main():
    print_intro()
    current_model = get_setting("model", DEFAULT_MODEL)
    # Ensure API key exists for default model, prompt if missing
    ensure_api_key_for_model(current_model)
    agent = Agent(model=current_model)

    # Create a prompt session with styled input and hints toolbar
    session = create_input_session()

    while True:
        try:
            query = prompt_user(session)
            if query is None:
                print("Goodbye!")
                break
            if query:
                # Check if user wants to change model
                if query.strip() == "/model":
                    selected_model = select_model(current_model)
                    if selected_model:
                        # Check and prompt for API key if needed
                        if ensure_api_key_for_model(selected_model):
                            current_model = selected_model
                            set_setting("model", current_model)
                            agent = Agent(model=current_model)
                            print(f"\n✓ Model changed to \033[38;2;88;166;255m{selected_model}\033[0m\n")
                        else:
                            print(f"\n✗ Cannot use model {selected_model} without API key. Please try again.\n")
                    continue
                
                try:
                    agent.run(query)
                except KeyboardInterrupt:
                    print("\nOperation cancelled. You can ask a new question or press Ctrl+C to quit.\n")
                    continue
        except (KeyboardInterrupt, EOFError):
            print("\nGoodbye!")
            break


if __name__ == "__main__":
    main()
