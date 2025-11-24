from collections.abc import Callable
from json import dumps

import tweepy
from pydantic import BaseModel, Field

from cdp_agentkit_core.actions.social.twitter.action import TwitterAction

ACCOUNT_MENTIONS_PROMPT = """
This tool will return account mentions for the currently authenticated Twitter (X) user context.
Please note that this may only be called once every 15 minutes under the free api tier.

A successful response will return a message with the api response as a json payload:
    {"data": [{"id": "1857479287504584856", "edit_history_tweet_ids": ["1857479287504584856"], "text": "@CDPAgentKit reply"}], "meta": {"result_count": 1, "newest_id": "1857479287504584856", "oldest_id": "1857479287504584856"}}


A failure response will return a message with the tweepy client api request error:
    Error retrieving authenticated user account mentions: 429 Too Many Requests

"""


class AccountMentionsInput(BaseModel):
    """Input argument schema for Twitter account mentions action."""

    account_id: str = Field(
        ...,
        description="The account id for the Twitter (X) user to get mentions for",
    )


def account_mentions(client: tweepy.Client, account_id: str) -> str:
    """Get the authenticated Twitter (X) user account mentions.

    Args:
        client (tweepy.Client): The Twitter (X) client used to authenticate with.
        account_id (str): The Twitter (X) account id to  get mentions for.

    Returns:
        str: A message containing account mentions for the authenticated user context.

    """
    message = ""

    print(f"attempting to get mentions for account_id: {account_id}")

    try:
        response = client.get_users_mentions(account_id)
        message = f"Successfully retrieved authenticated user account mentions:\n{dumps(response)}"
    except tweepy.errors.TweepyException as e:
        message = f"Error retrieving authenticated user account mentions:\n{e}"

    return message


class AccountMentionsAction(TwitterAction):
    """Twitter (X) account mentions action."""

    name: str = "account_mentions"
    description: str = ACCOUNT_MENTIONS_PROMPT
    args_schema: type[BaseModel] | None = AccountMentionsInput
    func: Callable[..., str] = account_mentions
