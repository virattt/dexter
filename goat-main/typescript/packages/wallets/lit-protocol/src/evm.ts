import type { EVMReadRequest, EVMReadResult, EVMTransaction, EVMTypedData } from "@goat-sdk/wallet-evm";
import type { AccsDefaultParams, SessionSigsMap } from "@lit-protocol/types";
import { type EthereumLitTransaction, StoredKeyData, api } from "@lit-protocol/wrapped-keys";
import { formatEther, isAddress, publicActions } from "viem";
import { signEip712MessageLitActionCode } from "./litActions/evmWrappedKeySignEip712Message";
import type { LitEVMWalletOptions } from "./types";

import { type EvmChain, NativeCurrency, type Signature } from "@goat-sdk/core";
import { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { LitNodeClient } from "@lit-protocol/lit-node-client";

import { WalletClient as ViemWalletClient } from "viem";

const { signMessageWithEncryptedKey, signTransactionWithEncryptedKey } = api;

export class LitEVMWalletClient extends EVMWalletClient {
    private litNodeClient: LitNodeClient;
    private pkpSessionSigs: SessionSigsMap;
    private wrappedKeyMetadata: StoredKeyData & { wrappedKeyAddress: string };
    private chainId: number;
    private litEVMChainIdentifier: string;
    private viemWalletClient: ViemWalletClient;

    private get viemPublicClient() {
        return this.viemWalletClient.extend(publicActions);
    }

    constructor(private options: LitEVMWalletOptions) {
        super();
        this.litNodeClient = options.litNodeClient;
        this.pkpSessionSigs = options.pkpSessionSigs;
        this.wrappedKeyMetadata = options.wrappedKeyMetadata;
        this.chainId = options.chainId;
        this.litEVMChainIdentifier = options.litEVMChainIdentifier;
        this.viemWalletClient = options.viemWalletClient;
    }

    private getPkpAccessControlCondition(pkpAddress: string): AccsDefaultParams {
        if (!isAddress(pkpAddress)) {
            throw new Error(`pkpAddress is not a valid Ethereum Address: ${pkpAddress}`);
        }

        return {
            contractAddress: "",
            standardContractType: "",
            chain: "ethereum",
            method: "",
            parameters: [":userAddress"],
            returnValueTest: {
                comparator: "=",
                value: pkpAddress,
            },
        };
    }

    private async waitForReceipt(hash: `0x${string}`): Promise<{ hash: string; status: string }> {
        const receipt = await this.viemPublicClient.waitForTransactionReceipt({
            hash,
        });
        return {
            hash: receipt.transactionHash,
            status: receipt.status ? "success" : "failure",
        };
    }

    getAddress(): string {
        return this.wrappedKeyMetadata.wrappedKeyAddress;
    }

    getChain(): EvmChain {
        return {
            type: "evm" as const,
            id: this.options.chainId ?? 0,
            nativeCurrency: this.viemWalletClient.chain?.nativeCurrency as NativeCurrency,
        };
    }

    async signMessage(message: string): Promise<Signature> {
        const signature = await signMessageWithEncryptedKey({
            pkpSessionSigs: this.pkpSessionSigs,
            network: "evm",
            id: this.wrappedKeyMetadata.id,
            messageToSign: message,
            litNodeClient: this.litNodeClient,
        });
        return { signature };
    }

    async signTypedData(data: EVMTypedData): Promise<Signature> {
        const response = await this.litNodeClient.executeJs({
            sessionSigs: this.pkpSessionSigs,
            code: signEip712MessageLitActionCode,
            jsParams: {
                accessControlConditions: [this.getPkpAccessControlCondition(this.wrappedKeyMetadata.pkpAddress)],
                ciphertext: this.wrappedKeyMetadata.ciphertext,
                dataToEncryptHash: this.wrappedKeyMetadata.dataToEncryptHash,
                messageToSign: JSON.stringify(data),
            },
        });

        return {
            signature: response.response as string,
        };
    }

    async sendTransaction(transaction: EVMTransaction): Promise<{ hash: string }> {
        const { to, abi, functionName, args, value } = transaction;
        const toAddress = to as `0x${string}`;

        // Simple ETH transfer (no ABI)
        if (!abi) {
            const litTransaction: EthereumLitTransaction = {
                chainId: this.chainId,
                chain: this.litEVMChainIdentifier,
                toAddress,
                value: formatEther(value ?? 0n),
            };

            const txHash = await signTransactionWithEncryptedKey({
                litNodeClient: this.litNodeClient,
                pkpSessionSigs: this.pkpSessionSigs,
                network: "evm",
                id: this.wrappedKeyMetadata.id,
                unsignedTransaction: litTransaction,
                broadcast: true,
            });
            return this.waitForReceipt(txHash as `0x${string}`);
        }

        // Contract call
        if (!functionName) {
            throw new Error("Function name is required for contract calls");
        }

        const { request } = await this.viemPublicClient.simulateContract({
            account: this.wrappedKeyMetadata.wrappedKeyAddress as `0x${string}`,
            address: toAddress,
            abi,
            functionName,
            args,
            chain: this.viemWalletClient.chain,
        });

        // Uses the viem wallet client to send the transaction
        const txHash = await this.viemWalletClient.writeContract(request);
        return this.waitForReceipt(txHash);
    }

    async read(request: EVMReadRequest): Promise<EVMReadResult> {
        const { address, abi, functionName, args } = request;
        if (!abi) throw new Error("Read request must include ABI for EVM");

        const result = await this.viemPublicClient.readContract({
            address: address as `0x${string}`,
            abi,
            functionName,
            args,
        });

        return { value: result };
    }

    async getNativeBalance() {
        const balance = await this.viemPublicClient.getBalance({
            address: this.wrappedKeyMetadata.wrappedKeyAddress as `0x${string}`,
        });

        return BigInt(balance);
    }
}

export function createEVMWallet(options: LitEVMWalletOptions) {
    return new LitEVMWalletClient(options);
}
