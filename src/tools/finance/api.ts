const BASE_URL = 'https://www.alphavantage.co/query';

export interface ApiResponse {
  data: Record<string, unknown>;
  url: string;
}

/**
 * Call the Alpha Vantage API with the specified function and parameters.
 * Alpha Vantage uses query parameters for all API calls, including the function type.
 *
 * @param functionName - The Alpha Vantage function (e.g., 'TIME_SERIES_DAILY', 'GLOBAL_QUOTE')
 * @param params - Additional parameters for the API call
 * @returns ApiResponse with data and the URL used
 */
export async function callApi(
  functionName: string,
  params: Record<string, string | number | string[] | undefined>
): Promise<ApiResponse> {
  // Read API key lazily at call time (after dotenv has loaded)
  // Support both ALPHAVANTAGE_API_KEY and ALPHA_VANTAGE_API_KEY for flexibility
  const ALPHA_VANTAGE_API_KEY = process.env.ALPHAVANTAGE_API_KEY || process.env.ALPHA_VANTAGE_API_KEY;
  const url = new URL(BASE_URL);

  // Add the function parameter first
  url.searchParams.append('function', functionName);

  // Add all other params to URL, handling arrays
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        value.forEach((v) => url.searchParams.append(key, v));
      } else {
        url.searchParams.append(key, String(value));
      }
    }
  }

  // Add API key as query parameter (Alpha Vantage style)
  url.searchParams.append('apikey', ALPHA_VANTAGE_API_KEY || '');

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // Alpha Vantage returns error messages in the response body
  if (data['Error Message']) {
    throw new Error(`Alpha Vantage API Error: ${data['Error Message']}`);
  }

  if (data['Note']) {
    // Rate limit warning
    throw new Error(`Alpha Vantage API Rate Limit: ${data['Note']}`);
  }

  if (data['Information']) {
    // API key issues or other informational messages
    throw new Error(`Alpha Vantage API Info: ${data['Information']}`);
  }

  return { data, url: url.toString() };
}
