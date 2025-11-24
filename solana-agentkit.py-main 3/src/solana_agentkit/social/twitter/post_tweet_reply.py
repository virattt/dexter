from collections.abc import Callable
from json import dumps

import tweepy
from pydantic import BaseModel, Field

from cdp_agentkit_core.actions.social.twitter import TwitterAction

POST_TWEET_REPLY_PROMPT = """
This tool will post a reply to a tweet on Twitter. The tool takes the text of the reply and the tweet id to reply to as input. Tweets can be maximum 280 characters.

A successful response will return a message with the api response as a json payload:
    {"data": {"id": "0123456789012345678", "text": "So good to be here!", "edit_history_tweet_ids": ["1234567890123456789"]}}

A failure response will return a message with the tweepy client api request error:
    You are not allowed to create a Tweet with duplicate content.

"""


class PostTweetReplyInput(BaseModel):
    """Input argument schema for twitter post tweet reply action."""

    tweet_id: str = Field(
        ...,
        description="The tweet id to post a reply to twitter",
    )

    tweet_reply: str = Field(
        ...,
        description="The text of the tweet to post in reply to another tweet on twitter. Tweets can be maximum 280 characters.",
    )


def post_tweet_reply(client: tweepy.Client, tweet_id: str, tweet_reply: str) -> str:
    """Post tweet reply to Twitter.

    Args:
        client (tweepy.Client): The tweepy client to use.
        tweet_id (str): The id of the tweet to reply to in twitter.
        tweet_reply (str): The text of the reply to post in reponse to a tweet on twitter.

    Returns:
        str: A message containing the result of the reply action and any associated data.

    """
    message = ""

    try:
        response = client.create_tweet(in_reply_to_tweet_id=tweet_id, text=tweet_reply)
        message = f"Successfully posted reply to Twitter:\n{dumps(response)}"
    except tweepy.errors.TweepyException as e:
        message = f"Error posting reply to Twitter:\n{e}"

    return message


class PostTweetReplyAction(TwitterAction):
    """Twitter (X) post tweet reply action."""

    name: str = "post_tweet_reply"
    description: str = POST_TWEET_REPLY_PROMPT
    args_schema: type[BaseModel] | None = PostTweetReplyInput
    func: Callable[..., str] = post_tweet_reply
