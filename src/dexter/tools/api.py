import os
import requests
import time
from typing import Dict, Any

####################################
# API Configuration
####################################

financial_datasets_api_key = os.getenv("FINANCIAL_DATASETS_API_KEY")

def call_api(endpoint: str, params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Helper function to call the Financial Datasets API with error handling and retries.

    Args:
        endpoint: API endpoint path (e.g., "/financials/income-statements/")
        params: Query parameters for the API call

    Returns:
        dict: JSON response from the API

    Raises:
        ValueError: If API key is missing or parameters are invalid
        RuntimeError: If API call fails after retries
    """
    if not financial_datasets_api_key:
        raise ValueError("FINANCIAL_DATASETS_API_KEY environment variable is not set")

    if not endpoint or not isinstance(endpoint, str):
        raise ValueError("Endpoint must be a non-empty string")

    if not isinstance(params, dict):
        raise ValueError("Params must be a dictionary")

    base_url = "https://api.financialdatasets.ai"
    url = f"{base_url}{endpoint}"
    headers = {"x-api-key": financial_datasets_api_key}

    # Retry logic for API calls
    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = requests.get(url, params=params, headers=headers, timeout=30)

            # Handle different HTTP status codes
            if response.status_code == 401:
                raise RuntimeError("Invalid API key - please check your FINANCIAL_DATASETS_API_KEY")
            elif response.status_code == 403:
                raise RuntimeError("API access forbidden - check your API key permissions")
            elif response.status_code == 429:
                # Rate limited - wait and retry
                if attempt < max_retries - 1:
                    wait_time = 2 ** attempt  # Exponential backoff
                    time.sleep(wait_time)
                    continue
                else:
                    raise RuntimeError("API rate limit exceeded - please try again later")
            elif response.status_code >= 500:
                # Server error - retry
                if attempt < max_retries - 1:
                    time.sleep(1)
                    continue
                else:
                    raise RuntimeError(f"Server error: {response.status_code} - {response.text}")

            response.raise_for_status()
            return response.json()

        except requests.exceptions.Timeout:
            if attempt < max_retries - 1:
                continue
            raise RuntimeError("API request timed out - please try again")

        except requests.exceptions.ConnectionError:
            if attempt < max_retries - 1:
                time.sleep(1)
                continue
            raise RuntimeError("Network connection error - please check your internet connection")

        except requests.exceptions.RequestException as e:
            raise RuntimeError(f"API request failed: {e}")

    raise RuntimeError("API call failed after all retry attempts")

