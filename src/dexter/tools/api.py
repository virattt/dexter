import os
import requests

####################################
# API Configuration
####################################

financial_datasets_api_key = os.getenv("FINANCIAL_DATASETS_API_KEY")


def call_api(endpoint: str, params: dict) -> dict:
    """Helper function to call the Financial Datasets API."""
    base_url = "https://api.financialdatasets.ai"
    url = f"{base_url}{endpoint}"
    headers = {"x-api-key": financial_datasets_api_key}
    response = requests.get(url, params=params, headers=headers)
    response.raise_for_status()
    return response.json()

