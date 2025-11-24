from collections.abc import Callable
from json import dumps

import tweepy
from pydantic import BaseModel

from cdp_agentkit_core.actions.social.twitter.action import TwitterAction

ACCOUNT_DETAILS_PROMPT = """
This tool will return account details for the currently authenticated Twitter (X) user context.

A successful response will return a message with the api response as a json payload:
    {"data": {"id": "1853889445319331840", "name": "CDP AgentKit", "username": "CDPAgentKit"}}

A failure response will return a message with the tweepy client api request error:
    Error retrieving authenticated user account: 429 Too Many Requests


"""


class AccountDetailsInput(BaseModel):
    """Input argument schema for Twitter account details action."""


def account_details(client: tweepy.Client) -> str:
    """Get the authenticated Twitter (X) user account details.

    Args:
        client (tweepy.Client): The Twitter (X) client used to authenticate with.

    Returns:
        str: A message containing account details for the authenticated user context.

    """
    message = ""

    try:
        response = client.get_me()
        data = response['data']
        data['url'] = f"https://x.com/{data['username']}"

        message = f"""Successfully retrieved authenticated user account details:\n{dumps(response)}"""
    except tweepy.errors.TweepyException as e:
        message = f"Error retrieving authenticated user account details:\n{e}"

    return message


class AccountDetailsAction(TwitterAction):
    """Twitter (X) account details action."""

    name: str = "account_details"
    description: str = ACCOUNT_DETAILS_PROMPT
    args_schema: type[BaseModel] | None = AccountDetailsInput
    func: Callable[..., str] = account_details
