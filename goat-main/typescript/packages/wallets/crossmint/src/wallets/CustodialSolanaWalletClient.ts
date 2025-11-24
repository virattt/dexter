import { CrossmintApiClient } from "@crossmint/common-sdk-base";
import { SolanWalletClientCtorParams, type SolanaTransaction, SolanaWalletClient } from "@goat-sdk/wallet-solana";
import { PublicKey, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { formatUnits } from "viem";
import { CrossmintWalletsAPI } from "./CrossmintWalletsAPI";

type CommonParameters = SolanWalletClientCtorParams & {
    chain: "solana";
};

type EmailLocatorParameters = CommonParameters & {
    email: string;
};

type PhoneLocatorParameters = CommonParameters & {
    phone: string;
};

type UserIdLocatorParameters = CommonParameters & {
    userId: number;
};

type AddressLocatorParameters = CommonParameters & {
    address: string;
};

type CustodialOptions =
    | EmailLocatorParameters
    | PhoneLocatorParameters
    | UserIdLocatorParameters
    | AddressLocatorParameters;

function getLocator(params: CustodialOptions): string {
    if ("address" in params) return params.address;
    if ("email" in params) return `email:${params.email}:solana-custodial-wallet`;
    if ("phone" in params) return `phone:${params.phone}:solana-custodial-wallet`;
    return `userId:${params.userId}:solana-custodial-wallet`;
}

export class CustodialSolanaWalletClient extends SolanaWalletClient {
    #locator: string;
    #client: CrossmintWalletsAPI;
    #address: string;

    constructor(address: string, crossmintClient: CrossmintWalletsAPI, options: CustodialOptions) {
        super({ connection: options.connection });
        this.#locator = getLocator(options);
        this.#address = address;
        this.#client = crossmintClient;
    }

    getAddress() {
        return this.#address;
    }

    async signMessage(message: string) {
        try {
            const { id } = await this.#client.signMessageForCustodialWallet(this.#locator, message);

            while (true) {
                const latestSignature = await this.#client.checkSignatureStatus(id, this.#address);

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

                await new Promise((resolve) => setTimeout(resolve, 3000)); // Wait 3 seconds
            }
        } catch (error) {
            throw new Error(`Failed to sign message: ${error}`);
        }
    }

    async sendTransaction({ instructions, addressLookupTableAddresses = [] }: SolanaTransaction) {
        const publicKey = new PublicKey("11111111111111111111111111111112");
        const message = new TransactionMessage({
            payerKey: publicKey,
            recentBlockhash: "11111111111111111111111111111111",
            instructions,
        }).compileToV0Message(await this.getAddressLookupTableAccounts(addressLookupTableAddresses));
        const transaction = new VersionedTransaction(message);
        const serializedVersionedTransaction = transaction.serialize();
        const encodedVersionedTransaction = bs58.encode(serializedVersionedTransaction);

        const { id: transactionId } = await this.#client.createSolanaTransaction(
            this.#locator,
            encodedVersionedTransaction,
        );

        while (true) {
            const latestTransaction = await this.#client.checkTransactionStatus(this.#locator, transactionId);

            if (latestTransaction.status === "success") {
                return {
                    hash: latestTransaction.onChain?.txId ?? "",
                };
            }

            if (latestTransaction.status === "failed") {
                throw new Error(`Transaction failed: ${latestTransaction.onChain?.txId}`);
            }

            await new Promise((resolve) => setTimeout(resolve, 3000)); // Wait 3 seconds
        }
    }

    async sendRawTransaction(transaction: string): Promise<{ hash: string }> {
        const { id: transactionId } = await this.#client.createSolanaTransaction(this.#locator, transaction);

        while (true) {
            const latestTransaction = await this.#client.checkTransactionStatus(this.#locator, transactionId);

            if (latestTransaction.status === "success") {
                return {
                    hash: latestTransaction.onChain?.txId ?? "",
                };
            }

            if (latestTransaction.status === "failed") {
                throw new Error(`Transaction failed: ${latestTransaction.onChain?.txId}`);
            }

            await new Promise((resolve) => setTimeout(resolve, 3000)); // Wait 3 seconds
        }
    }

    async balanceOf(address: string) {
        const pubkey = new PublicKey(address);
        const balance = await this.connection.getBalance(pubkey);

        return {
            value: formatUnits(BigInt(balance), 9),
            inBaseUnits: balance.toString(),
            decimals: 9,
            symbol: "SOL",
            name: "Solana",
        };
    }
}

export function custodialFactory(crossmintClient: CrossmintApiClient) {
    const walletsApi = new CrossmintWalletsAPI(crossmintClient);
    return async function custodial(options: CustodialOptions) {
        const { address } = await walletsApi.getWallet(getLocator(options));
        return new CustodialSolanaWalletClient(address, walletsApi, options);
    };
}
