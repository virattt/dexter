import type { EvmChain } from "@goat-sdk/core";
import {
    type EVMReadRequest,
    EVMSmartWalletClient,
    type EVMTransaction,
    type EVMTypedData,
} from "@goat-sdk/wallet-evm";
import { SigningMethod } from "@safe-global/protocol-kit";
import {
    type SafeClient,
    type SafeClientResult,
    type SdkStarterKitConfig,
    createSafeClient,
} from "@safe-global/sdk-starter-kit";
import {
    http,
    type Account,
    type Address,
    type Chain,
    type WalletClient as ViemWalletClient,
    createWalletClient,
    publicActions,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

class SafeWalletError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "SafeWalletError";
    }
}

class SafeNotInitializedError extends SafeWalletError {
    constructor() {
        super("Safe account not initialized");
    }
}

class SafeNotDeployedError extends SafeWalletError {
    constructor() {
        super("Safe is not deployed");
    }
}

class ChainNotConfiguredError extends SafeWalletError {
    constructor() {
        super("Chain not properly configured");
    }
}

export class SafeWalletClient extends EVMSmartWalletClient {
    #client: ViemWalletClient;
    #account: Account;
    #safeAccount: SafeClient | undefined;
    #safeAddress: Address | undefined;
    #isDeployed = false;
    #saltNonce?: string;
    #privateKey: `0x${string}`;

    constructor(privateKey: `0x${string}`, chain: Chain, saltNonce?: string) {
        super();
        if (!privateKey || !privateKey.startsWith("0x")) {
            throw new Error("Invalid private key format");
        }
        this.#privateKey = privateKey;
        this.#client = createWalletClient({
            account: privateKeyToAccount(privateKey),
            chain: chain,
            transport: http(),
        });
        if (!this.#client.account) {
            throw new Error("Client does not have an account");
        }
        this.#account = this.#client.account;
        this.#saltNonce = saltNonce;
    }

    async initialize(): Promise<void> {
        if (!this.#client.chain?.rpcUrls.default.http[0]) {
            throw new ChainNotConfiguredError();
        }

        const safeAccountConfig = {
            owners: [this.#account.address],
            threshold: 1,
            saltNonce: this.#saltNonce ?? "0",
        };

        const safeConfig: SdkStarterKitConfig =
            this.#isDeployed && this.#safeAddress
                ? {
                      provider: this.#client.chain.rpcUrls.default.http[0],
                      signer: this.#privateKey,
                      safeAddress: this.#safeAddress,
                  }
                : {
                      provider: this.#client.chain.rpcUrls.default.http[0],
                      signer: this.#privateKey,
                      safeOptions: safeAccountConfig,
                  };
        try {
            this.#safeAccount = await createSafeClient(safeConfig);
            this.#safeAddress = (await this.#safeAccount.getAddress()) as Address;
            this.#isDeployed = await this.#safeAccount.isDeployed();
        } catch (error) {
            throw new SafeWalletError(
                `Failed to initialize Safe: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    getAddress(): string {
        if (!this.#safeAddress) throw new SafeNotInitializedError();
        console.log(this.#safeAddress, "safe address");
        return this.#safeAddress;
    }

    async #createAndExecuteTransaction(
        metaTransactions: Array<{ to: string; value: string; data: string }>,
    ): Promise<SafeClientResult> {
        if (!this.#safeAccount) throw new SafeNotInitializedError();
        const transaction = await this.#safeAccount.send({
            transactions: metaTransactions,
        });
        if (!transaction) throw new SafeWalletError("Failed to create Safe transaction");

        return transaction;
    }

    async sendBatchOfTransactions(transactions: EVMTransaction[]): Promise<{ hash: string }> {
        try {
            const metaTransactions = transactions.map((tx) => ({
                to: tx.to,
                value: tx.value?.toString() ?? "0",
                data: tx.data ?? "0x",
            }));

            const result = await this.#createAndExecuteTransaction(metaTransactions);
            return { hash: result.transactions?.ethereumTxHash ?? "" };
        } catch (error) {
            throw new SafeWalletError(
                `Failed to send batch transactions: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    async sendTransaction(transaction: EVMTransaction): Promise<{ hash: string }> {
        try {
            const metaTransaction = {
                to: transaction.to,
                value: transaction.value?.toString() ?? "0",
                data: transaction.data ?? "0x",
            };

            const result = await this.#createAndExecuteTransaction([metaTransaction]);
            return { hash: result.transactions?.ethereumTxHash ?? "" };
        } catch (error) {
            throw new SafeWalletError(
                `Failed to send transaction: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    async read(request: EVMReadRequest) {
        const { address, abi, functionName, args } = request;
        if (!abi) throw new Error("Read request must include ABI for EVM");

        const result = await this.#client.extend(publicActions).readContract({
            address: address as `0x${string}`,
            abi,
            functionName,
            args,
        });

        return { value: result };
    }

    async signMessage(message: string) {
        if (!this.#safeAccount) throw new SafeNotInitializedError();

        try {
            const safeMessage = this.#safeAccount.protocolKit.createMessage(message);
            const signature = await this.#safeAccount.protocolKit.signMessage(safeMessage, SigningMethod.ETH_SIGN);
            return { signature: signature.encodedSignatures() };
        } catch (error) {
            throw new SafeWalletError(
                `Failed to sign message: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    async #createTypedDataDomain(data: EVMTypedData) {
        const domainFields = Object.entries(data.domain)
            .filter(([key]) => key !== "chainId")
            .map(([name, value]) => ({
                name,
                type: typeof value === "string" ? "string" : "uint256",
            }));

        return {
            ...domainFields,
            chainId: this.#client.chain?.id ?? 0,
        };
    }

    async #createTypedDataTypes(data: EVMTypedData, domainFields: Array<{ name: string; type: string }>) {
        const types = Object.entries(data.types).reduce(
            (acc, [key, value]) => {
                acc[key] = Array.isArray(value) ? value : [];
                return acc;
            },
            {} as Record<string, Array<{ name: string; type: string }>>,
        );

        return {
            EIP712Domain: [{ name: "chainId", type: "uint256" }, ...domainFields],
            ...types,
        };
    }

    async signTypedData(data: EVMTypedData) {
        if (!this.#safeAccount) throw new SafeNotInitializedError();

        try {
            const domainFields = Object.entries(data.domain)
                .filter(([key]) => key !== "chainId")
                .map(([name, value]) => ({
                    name,
                    type: typeof value === "string" ? "string" : "uint256",
                }));

            const typeData = {
                domain: await this.#createTypedDataDomain(data),
                message: data.message,
                types: await this.#createTypedDataTypes(data, domainFields),
                primaryType: data.primaryType,
            };

            const safeMessage = this.#safeAccount.protocolKit.createMessage(typeData);
            const signature = await this.#safeAccount.protocolKit.signMessage(safeMessage, SigningMethod.ETH_SIGN);
            return { signature: signature.encodedSignatures() };
        } catch (error) {
            throw new SafeWalletError(
                `Failed to sign typed data: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    async getNativeBalance() {
        const balance = await this.#client.extend(publicActions).getBalance({
            address: this.#safeAddress as `0x${string}`,
        });

        const chain = this.#client.chain ?? mainnet;

        return BigInt(balance);
    }

    getChain(): EvmChain {
        if (!this.#client.chain) throw new Error("Chain not initialized");
        return {
            type: "evm" as const,
            id: this.#client.chain.id,
            nativeCurrency: this.#client.chain.nativeCurrency,
        };
    }

    async isDeployed() {
        if (!this.#safeAccount) throw new Error("Safe account not initialized");
        if (!this.#safeAddress) throw new Error("Safe address not initialized");
        if (this.#isDeployed) return true;

        return await this.#safeAccount.isDeployed();
    }
}

export async function safe(privateKey: `0x${string}`, chain: Chain, saltNonce?: string): Promise<SafeWalletClient> {
    const wallet = new SafeWalletClient(privateKey, chain, saltNonce);
    await wallet.initialize();
    return wallet;
}
