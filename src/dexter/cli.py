import argparse
import os

from dotenv import load_dotenv
from prompt_toolkit import PromptSession
from prompt_toolkit.history import InMemoryHistory

from dexter.agent import Agent
from dexter.tools import AVAILABLE_DATA_PROVIDERS
from dexter.utils.intro import print_intro


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the Dexter financial research agent.")
    parser.add_argument(
        "--provider",
        choices=AVAILABLE_DATA_PROVIDERS,
        default=os.getenv("DEXTER_DATA_PROVIDER", "financialdatasets"),
        help="Select the data provider backend. Overrides the DEXTER_DATA_PROVIDER environment variable.",
    )
    return parser.parse_args()


def main():
    load_dotenv()
    args = _parse_args()
    print_intro()
    agent = Agent(data_provider=args.provider)

    session = PromptSession(history=InMemoryHistory())

    while True:
        try:
            query = session.prompt(">> ")
            if query.lower() in {"exit", "quit"}:
                print("Goodbye!")
                break
            if query:
                agent.run(query)
        except (KeyboardInterrupt, EOFError):
            print("\nGoodbye!")
            break


if __name__ == "__main__":
    main()
