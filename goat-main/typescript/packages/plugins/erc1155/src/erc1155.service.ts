import { Tool } from "@goat-sdk/core";
import { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { ERC1155_ABI } from "./abi";
import {
    BalanceOfBatchParameters,
    BalanceOfParameters,
    GetTokenInfoBySymbolParameters,
    IsApprovedForAllParameters,
    SafeBatchTransferFromParameters,
    SafeTransferFromParameters,
    SetApprovalForAllParameters,
} from "./parameters";
import { type Token } from "./token";

export class Erc1155Service {
    private tokens: Token[];

    constructor({ tokens }: { tokens?: Token[] } = {}) {
        this.tokens = tokens ?? [];
    }

    @Tool({
        description:
            "Get the ERC1155 token info by its symbol, including the contract address, token id, decimals, name, metadata URI and total token supply",
    })
    async getTokenInfoBySymbol(walletClient: EVMWalletClient, parameters: GetTokenInfoBySymbolParameters) {
        const token = this.tokens.find((token) =>
            [token.symbol, token.symbol.toLowerCase()].includes(parameters.symbol),
        );

        if (!token) {
            throw Error(`Token with symbol ${parameters.symbol} not found`);
        }

        const chain = walletClient.getChain();

        const contractAddress = token.chains[chain.id]?.contractAddress;

        if (!contractAddress) {
            throw Error(`Token with symbol ${parameters.symbol} not found on chain ${chain.id}`);
        }

        return {
            symbol: token?.symbol,
            contractAddress,
            id: token?.id,
            decimals: token?.decimals,
            name: token?.name,
            uri: token?.uri,
            totalSupply: token?.totalSupply,
        };
    }

    @Tool({
        description: "Get the balance of a specific ERC1155 token for a given owner",
    })
    async balanceOf(walletClient: EVMWalletClient, parameters: BalanceOfParameters) {
        try {
            const rawBalance = await walletClient.read({
                address: parameters.tokenAddress,
                abi: ERC1155_ABI,
                functionName: "balanceOf",
                args: [parameters.owner, parameters.id],
            });

            return Number(rawBalance.value);
        } catch (error) {
            throw Error(`Failed to fetch balance: ${error}`);
        }
    }

    @Tool({
        description: "Get the balances of multiple ERC1155 tokens for multiple owners",
    })
    async balanceOfBatch(walletClient: EVMWalletClient, parameters: BalanceOfBatchParameters) {
        try {
            const rawBalances = await walletClient.read({
                address: parameters.tokenAddress,
                abi: ERC1155_ABI,
                functionName: "balanceOfBatch",
                args: [parameters.owners, parameters.ids],
            });

            const balances = (rawBalances.value as (number | string)[]).map((balance) => Number(balance));
            return balances;
        } catch (error) {
            throw Error(`Failed to fetch batch balances: ${error}`);
        }
    }

    @Tool({
        description: "Transfer a specific ERC1155 token from one address to another",
    })
    async safeTransferFrom(walletClient: EVMWalletClient, parameters: SafeTransferFromParameters) {
        try {
            const from = parameters.from as `0x${string}`;
            const to = parameters.to as `0x${string}`;

            const hash = await walletClient.sendTransaction({
                to: parameters.tokenAddress,
                abi: ERC1155_ABI,
                functionName: "safeTransferFrom",
                args: [from, to, parameters.id, parameters.value, parameters.data ?? "0x"],
            });
            return hash.hash;
        } catch (error) {
            throw Error(`Failed to transfer: ${error}`);
        }
    }

    @Tool({
        description: "Transfer multiple ERC1155 tokens from one address to another",
    })
    async safeBatchTransferFrom(walletClient: EVMWalletClient, parameters: SafeBatchTransferFromParameters) {
        try {
            const from = parameters.from as `0x${string}`;
            const to = parameters.to as `0x${string}`;

            const hash = await walletClient.sendTransaction({
                to: parameters.tokenAddress,
                abi: ERC1155_ABI,
                functionName: "safeBatchTransferFrom",
                args: [from, to, parameters.ids, parameters.values, parameters.data ?? "0x"],
            });
            return hash.hash;
        } catch (error) {
            throw Error(`Failed to batch transfer: ${error}`);
        }
    }

    @Tool({
        description: "Set or unset approval for an operator to manage all of the caller's tokens",
    })
    async setApprovalForAll(walletClient: EVMWalletClient, parameters: SetApprovalForAllParameters) {
        try {
            const operator = parameters.operator as `0x${string}`;

            const hash = await walletClient.sendTransaction({
                to: parameters.tokenAddress,
                abi: ERC1155_ABI,
                functionName: "setApprovalForAll",
                args: [operator, parameters.approved],
            });
            return hash.hash;
        } catch (error) {
            throw Error(`Failed to set approval: ${error}`);
        }
    }

    @Tool({
        description: "Check if an operator is approved to manage all of the owner's tokens",
    })
    async isApprovedForAll(walletClient: EVMWalletClient, parameters: IsApprovedForAllParameters) {
        try {
            const owner = parameters.owner as `0x${string}`;
            const operator = parameters.operator as `0x${string}`;

            const approved = await walletClient.read({
                address: parameters.tokenAddress,
                abi: ERC1155_ABI,
                functionName: "isApprovedForAll",
                args: [owner, operator],
            });

            return approved;
        } catch (error) {
            throw Error(`Failed to fetch balance: ${error}`);
        }
    }
}
