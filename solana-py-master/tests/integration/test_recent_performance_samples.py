"""These tests live in their own file so that their sleeping doesn't slow down other tests."""

import time

from pytest import fixture, mark

from ..utils import assert_valid_response


@fixture(scope="session")
def _wait_until_ready() -> None:
    """Sleep for a minute so that performance samples are available."""
    time.sleep(60)


@mark.integration
@mark.asyncio
async def test_get_recent_performance_samples_async(test_http_client_async, _wait_until_ready):
    """Test get recent performance samples (async)."""
    resp = await test_http_client_async.get_recent_performance_samples(4)
    assert_valid_response(resp)


@mark.integration
def test_get_recent_performance_samples(test_http_client, _wait_until_ready):
    """Test get recent performance samples (synchronous)."""
    resp = test_http_client.get_recent_performance_samples(4)
    assert_valid_response(resp)
