import { Tool } from "@goat-sdk/core";
import { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { parseUnits } from "viem";
import { EZETH_ABI } from "./abi/ezeth";
import { RENZO_ABI } from "./abi/renzo";
import { BalanceOfParams, DepositETHParams, DepositParams, GetDepositAddressParams } from "./parameters";
import { getRenzoAddresses } from "./types/ChainSpecifications";

export class RenzoService {
    @Tool({
        name: "deposit_erc20_LST_into_renzo",
        description:
            "Deposit ERC20 LST tokens into Renzo, approve the ERC20 contract to spend the tokens before calling this",
    })
    async depositERC20(walletClient: EVMWalletClient, parameters: DepositParams) {
        try {
            const { renzoDepositAddress } = getRenzoAddresses(walletClient.getChain().id);
            const depositToken = await walletClient.read({
                address: renzoDepositAddress,
                abi: RENZO_ABI,
                functionName: "depositToken",
            });

            const depositTokenAddress = (depositToken as { value: `0x${string}` }).value;
            if (
                parameters.tokenAddress.toLowerCase() !== depositTokenAddress.toLowerCase() // Now we can safely call toLowerCase()
            ) {
                throw new Error(
                    `Invalid token: ${parameters.tokenAddress}. Expected deposit token: ${depositTokenAddress}`,
                );
            }
            const deadline = BigInt(Math.floor(Date.now() / 1000) + 300); // current time + 5 minutes

            const hash = await walletClient.sendTransaction({
                to: renzoDepositAddress,
                abi: RENZO_ABI,
                functionName: "deposit",
                args: [
                    parameters.amountIn,
                    parameters.minOut,
                    deadline, // Use the calculated deadline
                ],
            });
            return hash.hash;
        } catch (error) {
            throw Error(`Failed to deposit ERC20: ${error}`);
        }
    }

    @Tool({
        name: "deposit_eth_into_renzo",
        description: "Deposit ETH into Renzo",
    })
    async depositETH(walletClient: EVMWalletClient, parameters: DepositETHParams): Promise<string> {
        try {
            const { renzoDepositAddress } = getRenzoAddresses(walletClient.getChain().id);
            const minOut = parseUnits(parameters.minOut, 18);
            const value = parseUnits(parameters.value, 18);

            const deadline = BigInt(Math.floor(Date.now() / 1000) + 300); // 5 minutes from now

            const hash = await walletClient.sendTransaction({
                to: renzoDepositAddress,
                abi: RENZO_ABI,
                functionName: "depositETH",
                args: [minOut, deadline],
                value,
            });

            return hash.hash;
        } catch (error) {
            throw Error(`Failed to deposit ETH: ${error}`);
        }
    }

    @Tool({
        name: "check_ezeth_balance_in_renzo",
        description: "Check the ezETH balance of an address",
    })
    async getEzEthBalance(walletClient: EVMWalletClient, parameters: BalanceOfParams): Promise<string> {
        try {
            const { l2EzEthAddress } = getRenzoAddresses(walletClient.getChain().id);
            const balanceResult = await walletClient.read({
                address: l2EzEthAddress,
                abi: EZETH_ABI,
                functionName: "balanceOf",
                args: [parameters.address],
            });
            const balance = (balanceResult as { value: bigint }).value;
            return balance.toString();
        } catch (error) {
            throw Error(`Failed to get ezETH balance: ${error}`);
        }
    }

    @Tool({
        name: "renzo_get_deposit_address",
        description:
            "Get the Renzo deposit contract address for the current chain. Call this to get the address to send ETH to, not needed for ERC20 deposits.",
    })
    async getRenzoDepositAddress(walletClient: EVMWalletClient, parameters: GetDepositAddressParams): Promise<string> {
        try {
            const { renzoDepositAddress } = getRenzoAddresses(walletClient.getChain().id);
            return renzoDepositAddress;
        } catch (error) {
            throw Error(`Failed to get Renzo deposit address: ${error}`);
        }
    }
}
