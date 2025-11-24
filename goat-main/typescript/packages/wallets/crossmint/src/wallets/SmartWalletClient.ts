import { CrossmintApiClient } from "@crossmint/common-sdk-base";
import { NativeCurrency } from "@goat-sdk/core";
import { EvmChain } from "@goat-sdk/core";
import {
    EVMReadRequest,
    EVMSmartWalletClient,
    EVMTransaction,
    EVMTypedData,
    EVMWalletClientCtorParams,
} from "@goat-sdk/wallet-evm";
import { http, Abi, type PublicClient, createPublicClient, encodeFunctionData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { SupportedSmartWalletChains, getViemChain } from "../chains";
import { CrossmintWalletsAPI } from "./CrossmintWalletsAPI";

export type CustodialSigner = `0x${string}`;

export type KeyPairSigner = {
    secretKey: `0x${string}`;
};

type EmailLinkedUser = {
    email: string;
};

type PhoneLinkedUser = {
    phone: string;
};

type UserIdLinkedUser = {
    userId: number;
};

type LinkedUser = EmailLinkedUser | PhoneLinkedUser | UserIdLinkedUser;

export type SmartWalletOptions = EVMWalletClientCtorParams & {
    signer: CustodialSigner | KeyPairSigner;
    address?: string;
    linkedUser?: LinkedUser;
    chain: SupportedSmartWalletChains;
    provider: string;
    options?: {
        ensProvider?: string;
    };
};

function getLocator(address: string | undefined, linkedUser: LinkedUser | undefined) {
    if (linkedUser) {
        if ("email" in linkedUser) {
            return `email:${linkedUser.email}:evm-smart-wallet`;
        }
        if ("phone" in linkedUser) {
            return `phone:${linkedUser.phone}:evm-smart-wallet`;
        }
        if ("userId" in linkedUser) {
            return `userId:${linkedUser.userId}:evm-smart-wallet`;
        }
    }

    if (!address) {
        throw new Error("A Smart Wallet address is required if no linked user is provided");
    }

    return address;
}

function buildTransactionData({
    recipientAddress,
    abi,
    functionName,
    args,
    value,
}: {
    recipientAddress: string;
    abi?: Abi;
    functionName?: string;
    args?: unknown[];
    value?: bigint;
}) {
    if (!abi) {
        return {
            to: recipientAddress,
            value: value?.toString() ?? "0",
            data: "0x",
        };
    }

    if (!functionName) {
        throw new Error("Function name is required");
    }

    return {
        to: recipientAddress,
        value: value?.toString() ?? "0",
        data: encodeFunctionData({ abi, functionName, args }),
    };
}

export class SmartWalletClient extends EVMSmartWalletClient {
    #locator: string;
    #client: CrossmintWalletsAPI;
    #chain: SupportedSmartWalletChains;
    #signer: CustodialSigner | KeyPairSigner;
    #address: string;
    #viemClient: PublicClient;
    #ensClient: PublicClient;

    private get hasCustodialSigner() {
        return typeof this.#signer === "string";
    }

    private get secretKey() {
        if (typeof this.#signer === "string") {
            return null;
        }
        return this.#signer.secretKey;
    }

    private get signerAccount() {
        if (typeof this.#signer === "string") {
            return null;
        }
        return privateKeyToAccount(this.#signer.secretKey);
    }

    constructor(address: string, apiClient: CrossmintWalletsAPI, options: SmartWalletOptions) {
        super();
        this.#locator = getLocator(options.address, options.linkedUser);
        this.#address = address;
        this.#client = apiClient;
        this.#chain = options.chain;
        this.#signer = options.signer;

        this.#viemClient = createPublicClient({
            chain: getViemChain(options.chain),
            transport: http(options.provider),
        });

        this.#ensClient = createPublicClient({
            chain: mainnet,
            transport: http(options.options?.ensProvider ?? ""),
        });
    }

    getAddress() {
        return this.#address;
    }

    getChain(): EvmChain {
        return {
            type: "evm" as const,
            id: this.#viemClient.chain?.id ?? 0,
            nativeCurrency: this.#viemClient.chain?.nativeCurrency as NativeCurrency,
        };
    }

    async signMessage(message: string) {
        const { id: signatureId, approvals } = await this.#client.signMessageForSmartWallet(
            this.#address,
            message,
            this.#chain,
            this.signerAccount?.address,
        );

        if (!this.hasCustodialSigner) {
            const account = this.signerAccount;
            if (!account) {
                throw new Error("Signer account is not available");
            }
            const toSign = approvals?.pending[0].message;
            const signature = await account.signMessage({
                message: { raw: toSign as `0x${string}` },
            });

            await this.#client.approveSignatureForSmartWallet(
                signatureId,
                this.#address,
                `evm-keypair:${this.signerAccount?.address}`,
                signature,
            );
        }

        while (true) {
            const latestSignature = await this.#client.checkSignatureStatus(signatureId, this.#address);

            if (latestSignature.status === "success") {
                if (!latestSignature.outputSignature) {
                    throw new Error("Signature is undefined");
                }

                return {
                    signature: latestSignature.outputSignature,
                };
            }

            if (latestSignature.status === "failed") {
                throw new Error("Signature failed");
            }

            await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds
        }
    }

    async signTypedData(data: EVMTypedData) {
        const { id: signatureId, approvals } = await this.#client.signTypedDataForSmartWallet(
            this.#address,
            data,
            this.#chain,
            `evm-keypair:${this.signerAccount?.address}`,
        );

        if (!this.hasCustodialSigner) {
            const account = this.signerAccount;
            if (!account) {
                throw new Error("Signer account is not available");
            }
            const toSign = approvals?.pending[0].message;
            const signature = await account.signMessage({
                message: { raw: toSign as `0x${string}` },
            });

            await this.#client.approveSignatureForSmartWallet(
                signatureId,
                this.#address,
                `evm-keypair:${this.signerAccount?.address}`,
                signature,
            );
        }

        while (true) {
            const latestSignature = await this.#client.checkSignatureStatus(signatureId, this.#address);

            if (latestSignature.status === "success") {
                if (!latestSignature.outputSignature) {
                    throw new Error("Signature is undefined");
                }

                return {
                    signature: latestSignature.outputSignature,
                };
            }

            if (latestSignature.status === "failed") {
                throw new Error("Signature failed");
            }

            await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds
        }
    }

    async sendTransaction(transaction: EVMTransaction) {
        return await this._sendBatchOfTransactions([transaction]);
    }

    async sendBatchOfTransactions(transactions: EVMTransaction[]) {
        return await this._sendBatchOfTransactions(transactions);
    }

    async read(request: EVMReadRequest) {
        const { address, abi, functionName, args } = request;
        if (!abi) throw new Error("Read request must include ABI for EVM");

        const result = await this.#viemClient.readContract({
            address: address as `0x${string}`,
            abi,
            functionName,
            args,
        });

        return { value: result };
    }

    async getNativeBalance() {
        const balance = await this.#viemClient.getBalance({
            address: this.#address as `0x${string}`,
        });

        return BigInt(balance);
    }

    private async _sendBatchOfTransactions(transactions: EVMTransaction[]) {
        const transactionDatas = transactions.map((transaction) => {
            const { to: recipientAddress, abi, functionName, args, value, data } = transaction;

            if (data) {
                return {
                    to: recipientAddress,
                    value: value?.toString() ?? "0",
                    data,
                };
            }

            return buildTransactionData({
                recipientAddress,
                abi,
                functionName,
                args,
                value,
            });
        });

        const transactionResponse = await this.#client.createEVMTransaction(
            this.#address,
            transactionDatas,
            this.#chain,
            this.signerAccount?.address as `0x${string}`,
        );

        if (!this.hasCustodialSigner) {
            const account = this.signerAccount;
            if (!account) {
                throw new Error("Signer account is not available");
            }
            const userOpHash = transactionResponse.approvals?.pending[0].message;

            if (!userOpHash) {
                throw new Error("User operation hash is not available");
            }
            const signature = await account.signMessage({
                message: { raw: userOpHash as `0x${string}` },
            });

            await this.#client.approveTransaction(this.#locator, transactionResponse.id, [
                {
                    signature,
                    signer: `evm-keypair:${this.signerAccount?.address}`,
                },
            ]);
        }

        while (true) {
            const latestTransaction = await this.#client.checkTransactionStatus(this.#locator, transactionResponse.id);

            if (latestTransaction.status === "success" || latestTransaction.status === "failed") {
                return {
                    hash: latestTransaction.onChain?.txId ?? "",
                    status: latestTransaction.status,
                };
            }

            await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds
        }
    }
}

export function smartWalletFactory(crossmintClient: CrossmintApiClient) {
    const walletsApi = new CrossmintWalletsAPI(crossmintClient);
    return async function smartWallet(options: SmartWalletOptions) {
        const { address } = await walletsApi.getWallet(getLocator(options.address, options.linkedUser));
        return new SmartWalletClient(address, walletsApi, options);
    };
}
