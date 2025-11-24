import { Tool } from "@goat-sdk/core";
import { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { erc20Abi } from "viem";
import { getSprayContract } from "./abi/modespray.abi";
import { SUPPORTED_TOKENS, Token } from "./constants/supported-tokens";
import { GetInfoModeSprayTokensParams, SprayErc20TokenParams, SprayEtherParams } from "./parameters";

export class ModeSprayService {
    @Tool({
        name: "disperse_eth_to_multiple_addresses",
        description: "Spray or Disperse Ether to multiple recipients in a single transaction",
    })
    async sprayEther(
        walletClient: EVMWalletClient,
        parameters: SprayEtherParams,
    ): Promise<{ txHash?: string; chainId: number; message?: string }> {
        const network = walletClient.getChain();
        try {
            const { recipients, amounts } = parameters;

            if (!network?.id) {
                throw new Error("Unable to determine chain ID from wallet client");
            }

            const sprayContract = getSprayContract(network.id);

            const totalValue = amounts.reduce((sum, amount) => sum + BigInt(amount), BigInt(0));

            const { hash } = await walletClient.sendTransaction({
                to: sprayContract.address,
                abi: sprayContract.abi,
                functionName: "disperseEther",
                args: [recipients, amounts],
                value: totalValue,
            });

            return { txHash: hash, chainId: network.id, message: "You have sprayed ETH successfully" };
        } catch (error) {
            return { chainId: network.id, message: error instanceof Error ? error.message : JSON.stringify(error) };
        }
    }

    @Tool({
        name: "disperse_erc20_token_to_multiple_addresses",
        description: "Spray or Disperse ERC-20 tokens to multiple recipients in a single transaction",
    })
    async sprayToken(
        walletClient: EVMWalletClient,
        parameters: SprayErc20TokenParams,
    ): Promise<{ txHash?: string; chainId: number; message?: string }> {
        const network = walletClient.getChain();
        try {
            const { token, recipients, amounts } = parameters;

            if (!network?.id) {
                throw new Error("Unable to determine chain ID from wallet client");
            }

            const userAddress = walletClient.getAddress();
            if (!userAddress) {
                throw new Error("Could not get user address");
            }

            const sprayContract = getSprayContract(network.id);

            const totalValue = amounts.reduce((sum, amount) => sum + BigInt(amount), BigInt(0));

            const allowanceRaw = await walletClient.read({
                address: token,
                abi: erc20Abi,
                functionName: "allowance",
                args: [userAddress, sprayContract.address],
            });
            const allowance = BigInt(allowanceRaw.value as string);

            const amountInBigInt = BigInt(totalValue);
            if (allowance < amountInBigInt) {
                await walletClient.sendTransaction({
                    to: token,
                    abi: erc20Abi,
                    functionName: "approve",
                    args: [sprayContract.address, amountInBigInt],
                });
            }

            const tx = await walletClient.sendTransaction({
                to: sprayContract.address,
                abi: sprayContract.abi,
                functionName: "disperseToken",
                args: [token, recipients, amounts],
            });

            return { txHash: tx.hash, chainId: network.id, message: "You have sprayed the tokens successfully" };
        } catch (error) {
            return { chainId: network.id, message: error instanceof Error ? error.message : JSON.stringify(error) };
        }
    }

    @Tool({
        name: "get_spray_token_info_by_symbol",
        description: "Get Spray token info by symbol",
    })
    async getSprayTokenInfoBySymbol(
        walletClient: EVMWalletClient,
        parameters: GetInfoModeSprayTokensParams,
    ): Promise<Token> {
        const network = walletClient.getChain();

        if (!parameters.token) {
            throw new Error("You should provide a token name");
        }

        if (!network?.id) {
            throw new Error("Unable to determine chain ID from wallet client");
        }

        const symbol = parameters.token.toUpperCase();
        const token = SUPPORTED_TOKENS[symbol];

        if (!token) {
            const availableTokens = Object.keys(SUPPORTED_TOKENS).join(", ");
            throw new Error(`Token "${parameters.token}" not found. Available tokens: ${availableTokens}`);
        }

        if (!token.chains[network.id]) {
            const supportedChains = Object.keys(token.chains).join(", ");
            throw new Error(
                `Token "${parameters.token}" is not supported on chain ${network.id}. Supported chains: ${supportedChains}`,
            );
        }

        return {
            decimals: token.decimals,
            symbol: token.symbol,
            name: token.name,
            chains: {
                [network.id]: token.chains[network.id],
            },
        };
    }

    @Tool({
        name: "get_spray_supported_tokens",
        description: "Get a list of all tokens supported by ModeSpray",
    })
    async getSpraySupportedTokens(
        walletClient: EVMWalletClient,
        parameters: GetInfoModeSprayTokensParams,
    ): Promise<{ [key: string]: Token }> {
        const network = walletClient.getChain();
        if (network?.id) {
            const tokensInChain: Record<string, Token> = {};
            for (const [key, token] of Object.entries(SUPPORTED_TOKENS)) {
                if (token.chains[network.id]) {
                    tokensInChain[key] = token;
                }
            }
            return tokensInChain;
        }

        return SUPPORTED_TOKENS;
    }
}
