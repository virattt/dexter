import { NetworkType } from "./parameters";

const ETHERSCAN_API_BASE_URL = {
    mainnet: "https://api.etherscan.io/api",
    goerli: "https://api-goerli.etherscan.io/api",
    sepolia: "https://api-sepolia.etherscan.io/api",
};

export const buildUrl = (
    network: NetworkType,
    module: string,
    action: string,
    params: Record<string, string | number | boolean>,
) => {
    const baseUrl = ETHERSCAN_API_BASE_URL[network];
    const queryParams = new URLSearchParams({
        module,
        action,
        ...params,
    });
    return `${baseUrl}?${queryParams.toString()}`;
};

export const etherscanRequest = async (url: string, apiKey: string) => {
    const apiKeyParam = new URLSearchParams({ apikey: apiKey });
    const fullUrl = `${url}&${apiKeyParam.toString()}`;

    const response = await fetch(fullUrl);
    if (!response.ok) {
        throw new Error(`Etherscan API request failed: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.status === "0" && data.message === "NOTOK") {
        throw new Error(`Etherscan API error: ${data.result}`);
    }

    return data.result;
};
