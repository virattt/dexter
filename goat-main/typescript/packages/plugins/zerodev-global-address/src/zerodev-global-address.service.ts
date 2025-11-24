import { Tool } from "@goat-sdk/core";
import { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { FLEX, createCall, createGlobalAddress } from "@zerodev/global-address";
import { type Address, type Chain, erc20Abi } from "viem";
import { arbitrum, base, mainnet, mode, optimism, scroll } from "viem/chains";
import { CreateGlobalAddressConfigParams } from "./parameters";
import { GlobalAddressResponse, TokenActions, TokenConfig } from "./types";

interface FormattedFee {
    chainName: string;
    chainId: number;
    tokens: {
        name: string;
        symbol: string;
        minDeposit: string;
        fee: string;
        decimals: number;
    }[];
}

interface FormattedGlobalAddressResponse {
    globalAddress: string;
    formattedFees: FormattedFee[];
    rawEstimatedFees: GlobalAddressResponse["estimatedFees"];
    logs: string;
    targetChain_name: string;
}

interface FeeData {
    chainId: number;
    data: {
        token: string;
        name: string;
        decimal: number;
        minDeposit: string;
        fee: string;
    }[];
}

export class ZeroDevGlobalAddressService {
    private readonly supportedChains: Chain[] = [arbitrum, base, mainnet, mode, optimism, scroll];

    constructor(private readonly defaultSlippage: number = 5000) {}

    private getChainName(chainId: number): string {
        switch (chainId) {
            case mainnet.id:
                return "Ethereum Mainnet";
            case optimism.id:
                return "Optimism";
            case arbitrum.id:
                return "Arbitrum";
            case base.id:
                return "Base";
            case scroll.id:
                return "Scroll";
            case mode.id:
                return "Mode";
            default:
                return "Unknown Chain";
        }
    }

    private formatTokenAmount(hexAmount: string | undefined, decimals: number): string {
        if (!hexAmount) return "0";

        const amount = BigInt(hexAmount);
        const amountStr = amount.toString();
        const padded = amountStr.padStart(decimals + 1, "0");
        const decimalIndex = padded.length - decimals;
        const formattedAmount = `${padded.slice(0, decimalIndex)}.${padded.slice(decimalIndex)}`;
        return formattedAmount.replace(/\.?0+$/, "");
    }

    private formatLogsToString(globalAddress: string, formattedFees: FormattedFee[]): string {
        let logs = `Global Address: ${globalAddress}\n\nEstimated Fees by Chain:\n`;

        for (const chainFee of formattedFees) {
            logs += `\nChain: ${chainFee.chainName} (${chainFee.chainId}):\n`;
            for (const token of chainFee.tokens) {
                logs += `\n${token.name} (${token.symbol}):\n`;
                logs += `  Min Deposit: ${token.minDeposit}\n`;
                logs += `  Fee: ${token.fee}\n`;
                logs += `  Decimals: ${token.decimals}\n`;
            }
        }

        return logs;
    }

    @Tool({
        description: `Creates a global address that can receive tokens from multiple chains.
    A global address allows you to receive tokens on any supported chain and have them automatically bridged to your destination chain.

    Example prompts:
    - "Create a global address" (uses default wallet settings)
    - "Create a global address on base" (specifies base as destination chain)
    - "Create a global address for wallet 0x123...abc" (specifies owner address)
    - "Create a global address on arbitrum with 30% slippage"
    `,
    })
    async createGlobalAddressConfig(
        walletClient: EVMWalletClient,
        params: CreateGlobalAddressConfigParams,
    ): Promise<FormattedGlobalAddressResponse & { logs: string }> {
        const destChain =
            params.destinationChain ||
            this.supportedChains.find(({ id }) => id === walletClient.getChain().id) ||
            optimism;
        const slippage = params.slippage ?? this.defaultSlippage;
        const owner = params.owner ?? walletClient.getAddress();
        const allSrcTokens = this.getSourceTokens();
        const srcTokens = allSrcTokens.filter((token) => token.chain.id !== destChain.id);
        const actions = this.createActionConfig(owner as `0x${string}`);

        try {
            const { globalAddress, estimatedFees } = await createGlobalAddress({
                destChain,
                owner,
                slippage,
                actions,
                srcTokens,
            });

            const formattedFees = this.formatEstimatedFees(estimatedFees);
            const logs = this.formatLogsToString(globalAddress, formattedFees);
            const targetChain_name = `destination chain: ${this.getChainName(destChain.id)} (${destChain.id})`;

            return {
                globalAddress,
                formattedFees,
                rawEstimatedFees: estimatedFees,
                logs,
                targetChain_name,
            };
        } catch (error) {
            console.error("Error:", error);
            throw error;
        }
    }

    // Helper methods made private
    private getSourceTokens(): TokenConfig[] {
        return [
            // Ethereum Mainnet
            { tokenType: "NATIVE", chain: mainnet },
            { tokenType: "ERC20", chain: mainnet },

            // Base
            { tokenType: "NATIVE", chain: base },
            { tokenType: "ERC20", chain: base },

            // Optimism
            { tokenType: "NATIVE", chain: optimism },
            { tokenType: "ERC20", chain: optimism },

            // Arbitrum
            { tokenType: "NATIVE", chain: arbitrum },
            { tokenType: "ERC20", chain: arbitrum },

            // Scroll
            { tokenType: "NATIVE", chain: scroll },
            { tokenType: "ERC20", chain: scroll },

            // Mode
            { tokenType: "NATIVE", chain: mode },
            { tokenType: "ERC20", chain: mode },
        ];
    }

    private createERC20TransferCall(owner: Address) {
        return createCall({
            target: FLEX.TOKEN_ADDRESS,
            value: 0n,
            abi: erc20Abi,
            functionName: "transfer",
            args: [owner, FLEX.AMOUNT],
        });
    }

    private createNativeTransferCall(owner: Address) {
        return createCall({
            target: owner,
            value: FLEX.NATIVE_AMOUNT,
        });
    }

    private createActionConfig(owner: Address): TokenActions {
        return {
            ERC20: {
                action: [this.createERC20TransferCall(owner)],
                fallBack: [],
            },
            NATIVE: {
                action: [this.createNativeTransferCall(owner)],
                fallBack: [],
            },
            USDC: {
                action: [this.createERC20TransferCall(owner)],
                fallBack: [],
            },
            WRAPPED_NATIVE: {
                action: [this.createERC20TransferCall(owner)],
                fallBack: [],
            },
        };
    }

    private formatEstimatedFees(estimatedFees: (bigint | FeeData)[]): FormattedFee[] {
        return estimatedFees.map((fee) => {
            if (typeof fee === "bigint") {
                return {
                    chainName: this.getChainName(Number(fee)),
                    chainId: Number(fee),
                    tokens: [],
                };
            }

            return {
                chainName: this.getChainName(fee.chainId),
                chainId: fee.chainId,
                tokens: fee.data.map((tokenFee) => ({
                    name: tokenFee.name,
                    symbol: tokenFee.token,
                    minDeposit: this.formatTokenAmount(tokenFee.minDeposit, tokenFee.decimal),
                    fee: this.formatTokenAmount(tokenFee.fee, tokenFee.decimal),
                    decimals: tokenFee.decimal,
                })),
            };
        });
    }
}
