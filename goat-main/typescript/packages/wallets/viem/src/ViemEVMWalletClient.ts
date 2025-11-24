import type { EvmChain, Signature } from "@goat-sdk/core";
import {
    type EVMReadRequest,
    type EVMReadResult,
    type EVMTransaction,
    type EVMTypedData,
    EVMWalletClient,
    EVMWalletClientCtorParams,
} from "@goat-sdk/wallet-evm";
import { type WalletClient as ViemWalletClient, encodeFunctionData, publicActions } from "viem";
import { eip712WalletActions, getGeneralPaymasterInput } from "viem/zksync";

export type ViemOptions = EVMWalletClientCtorParams & {
    paymaster?: {
        defaultAddress: `0x${string}`;
        defaultInput?: `0x${string}`;
    };
};

export class ViemEVMWalletClient extends EVMWalletClient {
    #client: ViemWalletClient;
    #defaultPaymaster: `0x${string}`;
    #defaultPaymasterInput: `0x${string}`;

    private get publicClient() {
        return this.#client.extend(publicActions);
    }

    constructor(client: ViemWalletClient, options?: ViemOptions) {
        super({ tokens: options?.tokens, enableSend: options?.enableSend });
        this.#client = client;
        this.#defaultPaymaster = options?.paymaster?.defaultAddress ?? ("" as `0x${string}`);
        this.#defaultPaymasterInput =
            options?.paymaster?.defaultInput ??
            getGeneralPaymasterInput({
                innerInput: "0x",
            });
    }

    getAddress() {
        const address = this.#client.account?.address;
        if (!address) {
            console.warn("ViemEVMWalletClient: No account address found.");
            return "";
        }
        return address;
    }

    getChain(): EvmChain {
        const chain = this.#client.chain;
        if (!chain) {
            throw new Error("Viem client chain information is not available.");
        }
        if (
            !chain.nativeCurrency ||
            typeof chain.nativeCurrency.name !== "string" ||
            typeof chain.nativeCurrency.symbol !== "string" ||
            typeof chain.nativeCurrency.decimals !== "number"
        ) {
            throw new Error("Viem client chain nativeCurrency information is incomplete or invalid.");
        }

        return {
            type: "evm" as const,
            id: chain.id,
            nativeCurrency: {
                name: chain.nativeCurrency.name,
                symbol: chain.nativeCurrency.symbol,
                decimals: chain.nativeCurrency.decimals,
            },
        };
    }

    async getNativeBalance(): Promise<bigint> {
        const address = this.getAddress();
        if (!address) {
            throw new Error("Cannot get native balance: Address not available.");
        }
        const balance = await this.publicClient.getBalance({
            address: address as `0x${string}`,
        });
        return balance;
    }

    async signMessage(message: string): Promise<Signature> {
        if (!this.#client.account) throw new Error("No account connected");
        const signature = await this.#client.signMessage({
            message,
            account: this.#client.account,
        });
        return { signature };
    }

    async signTypedData(data: EVMTypedData): Promise<Signature> {
        if (!this.#client.account) throw new Error("No account connected");

        const domainChainId =
            typeof data.domain.chainId === "bigint" ? Number(data.domain.chainId) : data.domain.chainId;
        const domain = {
            ...data.domain,
            ...(domainChainId !== undefined && { chainId: domainChainId }),
        };

        const signature = await this.#client.signTypedData({
            domain: domain,
            types: data.types,
            primaryType: data.primaryType,
            message: data.message,
            account: this.#client.account,
        });
        return { signature };
    }

    async sendTransaction(transaction: EVMTransaction): Promise<{ hash: string; status?: string }> {
        const { to, abi, functionName, args, value, options, data } = transaction;
        if (!this.#client.account) throw new Error("No account connected");

        const toAddress = to as `0x${string}`;

        const paymaster = options?.paymaster?.address ?? this.#defaultPaymaster;
        const paymasterInput = options?.paymaster?.input ?? this.#defaultPaymasterInput;
        const txHasPaymaster = !!paymaster && !!paymasterInput;

        const sendingClient = txHasPaymaster ? this.#client.extend(eip712WalletActions()) : this.#client;

        if (!abi) {
            const txParams = {
                account: this.#client.account,
                to: toAddress,
                chain: this.#client.chain,
                value,
                data,
                ...(txHasPaymaster ? { paymaster, paymasterInput } : {}),
            };
            const txHash = await sendingClient.sendTransaction(txParams);
            return this.waitForReceipt(txHash);
        }

        if (!functionName) {
            throw new Error("Function name is required for contract calls with ABI");
        }

        try {
            const { request } = await this.publicClient.simulateContract({
                account: this.#client.account,
                address: toAddress,
                abi: abi,
                functionName,
                args,
                chain: this.#client.chain,
                value: value,
            });

            if (txHasPaymaster) {
                const dataToSend = encodeFunctionData({
                    abi: abi,
                    functionName,
                    args: args,
                });
                const txParams = {
                    account: this.#client.account,
                    chain: this.#client.chain,
                    to: request.address,
                    data: dataToSend,
                    value: request.value,
                    paymaster,
                    paymasterInput,
                };
                const txHash = await sendingClient.sendTransaction(txParams);
                return this.waitForReceipt(txHash);
            }

            const txHash = await sendingClient.writeContract(request);
            return this.waitForReceipt(txHash);
        } catch (simError) {
            console.error("Transaction simulation failed:", simError);
            throw new Error(
                `Transaction simulation failed: ${simError instanceof Error ? simError.message : String(simError)}`,
            );
        }
    }

    async read(request: EVMReadRequest): Promise<EVMReadResult> {
        const { address, abi, functionName, args } = request;
        if (!abi) throw new Error("Read request must include ABI for EVM");

        const result = await this.publicClient.readContract({
            address: address as `0x${string}`,
            abi,
            functionName,
            args,
        });

        return { value: result };
    }

    private async waitForReceipt(txHash: `0x${string}`): Promise<{ hash: string; status: "success" | "reverted" }> {
        const receipt = await this.publicClient.waitForTransactionReceipt({
            hash: txHash,
        });
        return { hash: receipt.transactionHash, status: receipt.status };
    }
}

export function viem(client: ViemWalletClient, options?: ViemOptions) {
    return new ViemEVMWalletClient(client, options);
}
