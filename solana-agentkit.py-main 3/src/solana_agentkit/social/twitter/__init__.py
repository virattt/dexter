from cdp_agentkit_core.actions.social.twitter.account_details import AccountDetailsAction
from cdp_agentkit_core.actions.social.twitter.account_mentions import AccountMentionsAction
from cdp_agentkit_core.actions.social.twitter.action import TwitterAction
from cdp_agentkit_core.actions.social.twitter.post_tweet import PostTweetAction
from cdp_agentkit_core.actions.social.twitter.post_tweet_reply import PostTweetReplyAction


def get_all_twitter_actions() -> list[type[TwitterAction]]:
    actions = []
    for action in TwitterAction.__subclasses__():
        actions.append(action())

    return actions


TWITTER_ACTIONS = get_all_twitter_actions()

__all__ = [
    "TWITTER_ACTIONS",
    "AccountDetailsAction",
    "AccountMentionsAction",
    "PostTweetAction",
    "PostTweetReplyAction",
    "TwitterAction",
]
