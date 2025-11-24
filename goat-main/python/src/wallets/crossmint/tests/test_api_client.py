import pytest
import os
import requests
from urllib.parse import quote
from goat_wallets.crossmint import CrossmintWalletsAPI


def test_authentication_headers(custodial_api, test_email):
    """Test authentication header structure."""
    # Make a request that will fail but still let us check headers
    response = requests.get(
        f"{custodial_api.base_url}/wallets/email:{test_email}:solana-mpc-wallet",
        headers={
            "x-api-key": custodial_api.api_key,
            "Content-Type": "application/json"
        }
    )
    assert "x-api-key" in response.request.headers
    assert response.request.headers["x-api-key"] == os.environ["CROSSMINT_STAGING_API_KEY_CUSTODIAL"]
    assert response.request.headers["Content-Type"] == "application/json"


def test_base_url_configuration(custodial_api):
    """Test base URL configuration."""
    assert custodial_api.base_url == "https://staging.crossmint.com/api/v1-alpha2"


def test_url_encoding_email(custodial_api, test_email):
    """Test URL parameter encoding with email."""
    # Make a request that will fail but still let us check URL encoding
    locator = f"email:{test_email}:solana-mpc-wallet"
    encoded = quote(locator)
    response = requests.get(
        f"{custodial_api.base_url}/wallets/{encoded}",
        headers={
            "x-api-key": custodial_api.api_key,
            "Content-Type": "application/json"
        }
    )
    # Verify URL was properly encoded
    url_parts = response.url.split("/wallets/")
    encoded_part = url_parts[1] if len(url_parts) > 1 else ""
    assert "@" not in encoded_part  # @ should be encoded as %40
    assert ":" not in encoded_part  # : should be encoded as %3A
    assert "%40" in encoded_part  # @ should be encoded as %40
    assert "%3A" in encoded_part  # : should be encoded as %3A
    assert response.status_code in [404, 200]  # Wallet may or may not exist


def test_url_encoding_special_chars(custodial_api):
    """Test URL parameter encoding with special characters."""
    special_chars = "test:user+@example.com"
    locator = f"email:{special_chars}:solana-mpc-wallet"
    encoded = quote(locator)
    response = requests.get(
        f"{custodial_api.base_url}/wallets/{encoded}",
        headers={
            "x-api-key": custodial_api.api_key,
            "Content-Type": "application/json"
        }
    )
    # Verify URL was properly encoded
    assert encoded in response.url
    assert response.status_code == 400  # Invalid wallet type


def test_error_handling_not_found(custodial_api):
    """Test error handling for non-existent wallet."""
    with pytest.raises(Exception) as exc:
        custodial_api.get_wallet_by_email("nonexistent@example.com", "solana")
    assert "Error" in str(exc.value)
    assert "404" in str(exc.value)


def test_error_handling_invalid_key(test_email):
    """Test error handling with invalid API key."""
    invalid_api = CrossmintWalletsAPI(
        api_key="invalid_key",
        base_url="https://staging.crossmint.com"
    )
    with pytest.raises(Exception) as exc:
        invalid_api.get_wallet_by_email(test_email, "solana")
    assert "Error" in str(exc.value)
    assert "401" in str(exc.value) or "403" in str(exc.value)


def test_error_handling_invalid_payload(custodial_api):
    """Test error handling with invalid request payload."""
    with pytest.raises(Exception) as exc:
        custodial_api._request(
            "/wallets",
            method="POST",
            json={"type": "invalid-wallet-type"}
        )
    assert "Error" in str(exc.value)
    assert "400" in str(exc.value)


def test_smart_wallet_api_key(smart_api, test_email):
    """Test smart wallet API key configuration."""
    # Make a request that will fail but still let us check headers
    response = requests.get(
        f"{smart_api.base_url}/wallets/email:{test_email}:ethereum-smart-wallet",
        headers={
            "x-api-key": smart_api.api_key,
            "Content-Type": "application/json"
        }
    )
    assert response.request.headers["x-api-key"] == os.environ["CROSSMINT_STAGING_API_KEY_SMART"]


def test_response_json_parsing(custodial_api):
    """Test JSON response parsing."""
    with pytest.raises(Exception) as exc:
        custodial_api.get_wallet_by_email("nonexistent@example.com", "solana")
    error_response = str(exc.value)
    assert "{" in error_response  # Should include formatted JSON error
    assert "}" in error_response


def test_request_timeout_handling(custodial_api, test_email):
    """Test request timeout handling."""
    with pytest.raises(Exception) as exc:
        custodial_api.get_wallet_by_email(
            test_email,
            "solana",
            timeout=0.001  # Very short timeout
        )
    error_msg = str(exc.value).lower()
    assert any(msg in error_msg for msg in ["timeout", "timed out", "unreachable"])
