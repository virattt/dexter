"""Util that calls Twitter API."""

import inspect
from collections.abc import Callable
from typing import Any

import tweepy
from langchain_core.utils import get_from_dict_or_env
from pydantic import BaseModel, model_validator


class TwitterApiWrapper(BaseModel):
    """Wrapper for Twitter API."""

    client: Any | None = None

    @model_validator(mode="before")
    @classmethod
    def validate_environment(cls, values: dict) -> Any:
        """Validate that Twitter access token, token secret, and tweepy exists in the environment."""
        api_key = get_from_dict_or_env(values, "twitter_api_key", "TWITTER_API_KEY")
        api_secret = get_from_dict_or_env(values, "twitter_api_secret", "TWITTER_API_SECRET")
        access_token = get_from_dict_or_env(values, "twitter_access_token", "TWITTER_ACCESS_TOKEN")
        access_token_secret = get_from_dict_or_env(values, "twitter_access_token_secret", "TWITTER_ACCESS_TOKEN_SECRET")
        bearer_token = get_from_dict_or_env(values, "twitter_bearer_token", "TWITTER_BEARER_TOKEN")

        try:
            import tweepy
        except Exception:
            raise ImportError(
                "Tweepy Twitter SDK is not installed. "

                "Please install it with `pip install tweepy`"
            ) from None

        client = tweepy.Client(
            consumer_key=api_key,
            consumer_secret=api_secret,
            access_token=access_token,
            access_token_secret=access_token_secret,
            bearer_token=bearer_token,
            return_type=dict,
        )

        values["client"] = client
        values["api_key"] = api_key
        values["api_secret"] = api_secret
        values["access_token"] = access_token
        values["access_token_secret"] = access_token_secret
        values["bearer_token"] = bearer_token

        return values

    def run_action(self, func: Callable[..., str], **kwargs) -> str:
        """Run a Twitter Action."""
        func_signature = inspect.signature(func)
        first_kwarg = next(iter(func_signature.parameters.values()), None)

        if first_kwarg and first_kwarg.annotation is tweepy.Client:
            return func(self.client, **kwargs)
        else:
            return func(**kwargs)
