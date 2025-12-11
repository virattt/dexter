import os
import requests

####################################
# API Configuration
####################################

# Default timeout for API requests (30 seconds)
DEFAULT_TIMEOUT = 30

financial_datasets_api_key = os.getenv("FINANCIAL_DATASETS_API_KEY")


def call_api(endpoint: str, params: dict, timeout: int = DEFAULT_TIMEOUT) -> dict:
    """Helper function to call the Financial Datasets API.

    Args:
        endpoint: API endpoint path
        params: Query parameters
        timeout: Request timeout in seconds (default: 30)

    Returns:
        JSON response as dictionary
    """
    base_url = "https://api.financialdatasets.ai"
    url = f"{base_url}{endpoint}"
    headers = {"x-api-key": financial_datasets_api_key}
    response = requests.get(url, params=params, headers=headers, timeout=timeout)
    response.raise_for_status()
    return response.json()

