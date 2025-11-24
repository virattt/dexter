"""Tool allows agents to interact with the Twitter API.

To use this tool, you must first set as environment variables:
    OPENAI_API_KEY
    TWITTER_API_KEY
    TWITTER_API_SECRET
    TWITTER_ACCESS_TOKEN
    TWITTER_ACCESS_TOKEN_SECRET
    TWITTER_BEARER_TOKEN

"""

from collections.abc import Callable
from typing import Any

from langchain_core.callbacks import CallbackManagerForToolRun
from langchain_core.tools import BaseTool
from pydantic import BaseModel

from twitter_langchain.twitter_api_wrapper import TwitterApiWrapper


class TwitterTool(BaseTool):  # type: ignore[override]
    """Tool for interacting with the Twitter API."""

    twitter_api_wrapper: TwitterApiWrapper
    name: str = ""
    description: str = ""
    args_schema: type[BaseModel] | None = None
    func: Callable[..., str]

    def _run(
        self,
        instructions: str | None = "",
        run_manager: CallbackManagerForToolRun | None = None,
        **kwargs: Any,
    ) -> str:
        """Use the Twitter (X) API to run an operation."""
        if not instructions or instructions == "{}":
            # Catch other forms of empty input that GPT-4 likes to send.
            instructions = ""
        if self.args_schema is not None:
            validated_input_data = self.args_schema(**kwargs)
            parsed_input_args = validated_input_data.model_dump()
        else:
            parsed_input_args = {"instructions": instructions}
        return self.twitter_api_wrapper.run_action(self.func, **parsed_input_args)
