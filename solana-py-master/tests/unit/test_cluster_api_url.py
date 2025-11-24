"""Test cluster_api_url."""

from solana.utils.cluster import cluster_api_url


def test_input_output():
    """Test that cluster_api_url generates the expected output."""
    assert cluster_api_url() == "https://api.devnet.solana.com"
    assert cluster_api_url("devnet") == "https://api.devnet.solana.com"
    assert cluster_api_url("devnet", True) == "https://api.devnet.solana.com"
    assert cluster_api_url("devnet", False) == "http://api.devnet.solana.com"
