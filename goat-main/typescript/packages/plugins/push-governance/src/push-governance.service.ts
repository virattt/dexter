import { Tool } from "@goat-sdk/core";
import { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { DELEGATE_ADDRESS, PUSH_ABI } from "./abi/push.abi";
import { DelegateParams, GetPushTokenAddressParams } from "./parameters";

export class PushGovernanceService {
    @Tool({
        name: "delegate_voting_power",
        description: "Delegate your voting power to a specified address",
    })
    async delegateVotingPower(
        walletClient: EVMWalletClient,
        parameters: DelegateParams,
    ): Promise<DelegateVotingPowerResponse> {
        try {
            const { delegateAddress } = parameters;

            const network = walletClient.getChain();
            if (!network?.id) {
                throw new Error("Unable to determine chain ID from wallet client");
            }

            const address = this.getContractAddress(network.id);

            const { hash } = await walletClient.sendTransaction({
                to: address,
                abi: PUSH_ABI,
                functionName: "delegate",
                args: [delegateAddress ?? walletClient.getAddress()],
            });

            return {
                hash: hash as `0x${string}`,
                chainId: network.id,
                newDelegateAddress: (delegateAddress ?? walletClient.getAddress()) as `0x${string}`,
            };
        } catch (error) {
            throw new Error(`Failed to delegate voting power: ${error}`);
        }
    }

    @Tool({
        name: "get_push_token_address",
        description: "Get the address of the PUSH token.",
    })
    async getPushTokenAddress(walletClient: EVMWalletClient, parameters: GetPushTokenAddressParams): Promise<Token> {
        const tokens: Record<string, Token> = {
            PUSH: {
                decimals: 18,
                symbol: "PUSH",
                name: "PUSH",
                chains: {
                    1: {
                        contractAddress: "0xf418588522d5dd018b425E472991E52EBBeEEEEE",
                    },
                    11155111: {
                        contractAddress: "0x37c779a1564DCc0e3914aB130e0e787d93e21804",
                    },
                },
            },
        };

        const network = walletClient.getChain();
        if (!network?.id) {
            throw new Error("Unable to determine chain ID from wallet client");
        }

        const token = tokens[parameters.symbol.toUpperCase()];
        if (!token) {
            throw new Error(`Token ${parameters.symbol} not found`);
        }
        const chain = token.chains[network.id];
        if (!chain) {
            throw new Error(`No contract address found for chainId ${network.id}`);
        }
        return {
            decimals: token.decimals,
            symbol: token.symbol,
            name: token.name,
            chains: { [network.id]: { contractAddress: chain.contractAddress } },
        };
    }

    @Tool({
        name: "get_push_balance",
        description: "Get the $PUSH balance of an address",
    })
    async getPushBalance(walletClient: EVMWalletClient, parameters: GetPushTokenAddressParams): Promise<string> {
        try {
            const address = walletClient.getAddress();
            const network = walletClient.getChain();
            const contractAddress = this.getContractAddress(network.id);

            const balance = await walletClient.read({
                address: contractAddress,
                abi: PUSH_ABI,
                functionName: "balanceOf",
                args: [address],
            });

            return String(balance.value);
        } catch (error) {
            throw new Error(`Failed to retrieve $PUSH balance: ${error}`);
        }
    }

    @Tool({
        name: "get_voting_power",
        description: "Get the current voting power of an address",
    })
    async getVotingPower(walletClient: EVMWalletClient, parameters: GetPushTokenAddressParams): Promise<string> {
        try {
            const address = walletClient.getAddress();
            const network = walletClient.getChain();
            const contractAddress = this.getContractAddress(network.id);

            const votingPower = await walletClient.read({
                address: contractAddress,
                abi: PUSH_ABI,
                functionName: "getCurrentVotes",
                args: [address],
            });

            return String(votingPower.value);
        } catch (error) {
            throw new Error(`Failed to retrieve voting power: ${error}`);
        }
    }

    @Tool({
        name: "get_delegated_to",
        description: "Get the address to which the voting power is delegated",
    })
    async getDelegatedTo(walletClient: EVMWalletClient, parameters: GetPushTokenAddressParams): Promise<string> {
        try {
            const address = walletClient.getAddress();
            const network = walletClient.getChain();
            const contractAddress = this.getContractAddress(network.id);

            const delegatedTo = await walletClient.read({
                address: contractAddress,
                abi: PUSH_ABI,
                functionName: "delegates",
                args: [address],
            });

            return delegatedTo.value as `0x${string}`;
        } catch (error) {
            return `Failed to retrieve delegated address: ${error}`;
        }
    }

    private getContractAddress(chainId: number): string {
        const address = DELEGATE_ADDRESS[chainId];
        if (!address) {
            throw new Error(`Delegate contract not available for chainId: ${chainId}`);
        }
        return address;
    }
}

interface Token {
    decimals: number;
    symbol: string;
    name: string;
    chains: Record<number, { contractAddress: `0x${string}` }>;
}

interface DelegateVotingPowerResponse {
    hash: `0x${string}`;
    chainId: number;
    newDelegateAddress: `0x${string}`;
}
