import { CrossmintApiClient } from "@crossmint/common-sdk-base";
import { Signature } from "@goat-sdk/core";
import { SolanWalletClientCtorParams, type SolanaTransaction, SolanaWalletClient } from "@goat-sdk/wallet-solana";
import { Keypair, PublicKey, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { CreateTransactionResponse, CrossmintWalletsAPI, SolanaDelegatedSignerResponse } from "./CrossmintWalletsAPI";

export type SolanaSmartWalletOptions = SolanWalletClientCtorParams & {
    config: {
        adminSigner:
            | {
                  type: "solana-keypair";
                  keypair: Keypair;
              }
            | {
                  type: "solana-fireblocks-custodial";
              };
    };
} & (
        | {
              linkedUser: {
                  email?: string;
                  phone?: string;
                  userId?: number;
              };
              address?: never;
          }
        | {
              address: string;
              linkedUser?: never;
          }
    );

function getLocator(address: string | undefined, linkedUser: SolanaSmartWalletOptions["linkedUser"]): string {
    if (linkedUser) {
        if (linkedUser.email) return `email:${linkedUser.email}:solana-smart-wallet`;
        if (linkedUser.phone) return `phone:${linkedUser.phone}:solana-smart-wallet`;
        if (linkedUser.userId) return `userId:${linkedUser.userId}:solana-smart-wallet`;
    }
    if (!address) throw new Error("Either address or linkedUser must be provided");
    return address;
}

export class SolanaSmartWalletClient extends SolanaWalletClient {
    readonly #locator: string;
    readonly #api: CrossmintWalletsAPI;
    readonly #address: string;
    readonly #adminSigner: SolanaSmartWalletOptions["config"]["adminSigner"];

    constructor(api: CrossmintWalletsAPI, address: string, options: SolanaSmartWalletOptions) {
        super({ connection: options.connection });
        this.#api = api;
        this.#address = address;
        this.#adminSigner = options.config.adminSigner;
        this.#locator = getLocator(options.address, options.linkedUser);
    }

    getAddress() {
        return this.#address;
    }

    async signMessage(message: string): Promise<Signature> {
        throw new Error("Signing not supported for smart wallets");
    }

    private async handleApprovals(
        transactionId: string,
        pendingApprovals: { signer: string; message: string }[],
        signers: Keypair[],
    ) {
        try {
            const submitApprovals = pendingApprovals.map((pendingApproval) => {
                const signer = signers.find((signer) => pendingApproval.signer.includes(signer.publicKey.toBase58()));
                if (!signer) {
                    throw new Error(`Signer not found for approval: ${pendingApproval.signer}`);
                }
                const signature = nacl.sign.detached(bs58.decode(pendingApproval.message), signer.secretKey);
                const encodedSignature = bs58.encode(signature);

                return {
                    signer: `solana-keypair:${signer.publicKey.toBase58()}`,
                    signature: encodedSignature,
                };
            });

            await this.#api.approveTransaction(this.#locator, transactionId, submitApprovals);
        } catch (error) {
            throw new Error(`Failed to send transaction approvals: ${error}`);
        }
    }

    private async handleTransactionFlow(
        transactionId: string,
        signers: Keypair[],
        errorPrefix = "Transaction",
    ): Promise<CreateTransactionResponse> {
        // Check initial transaction status
        let currentTransaction = await this.#api.checkTransactionStatus(this.#locator, transactionId);

        // Handle approvals if needed
        if (currentTransaction.status === "awaiting-approval") {
            const pendingApprovals = currentTransaction.approvals?.pending;
            if (pendingApprovals && pendingApprovals.length > 0) {
                await this.handleApprovals(transactionId, pendingApprovals, signers);
            }
        }

        // Wait for transaction success
        while (currentTransaction.status !== "success") {
            currentTransaction = await this.#api.checkTransactionStatus(this.#locator, transactionId);

            if (currentTransaction.status === "failed") {
                throw new Error(
                    `${errorPrefix} failed: ${currentTransaction.error?.reason}, ${currentTransaction.error?.message}`,
                );
            }

            if (currentTransaction.status === "awaiting-approval") {
                throw new Error(`${errorPrefix} still awaiting approval after submission`);
            }

            if (currentTransaction.status === "success") {
                break;
            }

            await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        return currentTransaction;
    }

    async sendTransaction(
        { instructions, signer, addressLookupTableAddresses = [] }: SolanaTransaction,
        additionalSigners: Keypair[] = [],
    ): Promise<{ hash: string }> {
        try {
            const publicKey = new PublicKey(this.#address);
            const message = new TransactionMessage({
                payerKey: publicKey,
                recentBlockhash: "11111111111111111111111111111111", // Filled by API
                instructions,
            }).compileToV0Message(await this.getAddressLookupTableAccounts(addressLookupTableAddresses));

            const transaction = new VersionedTransaction(message);
            const serializedVersionedTransaction = transaction.serialize();
            const encodedVersionedTransaction = bs58.encode(serializedVersionedTransaction);

            const hash = await this.sendRawTransaction(encodedVersionedTransaction, signer, additionalSigners);

            return hash;
        } catch (error) {
            throw new Error(`Failed to send transaction: ${error}`);
        }
    }

    async sendRawTransaction(
        transaction: string,
        signer?: Keypair,
        additionalSigners: Keypair[] = [],
    ): Promise<{ hash: string }> {
        try {
            const { id: transactionId } = await this.#api.createSolanaTransaction(this.#locator, transaction, signer);

            // Prepare signers array
            const signers = [
                // Only include adminSigner if no custom signer is provided and it's a non-custodial signer
                ...(signer ? [signer] : this.#adminSigner.type === "solana-keypair" ? [this.#adminSigner.keypair] : []),
                ...additionalSigners,
            ];

            // Handle transaction flow
            const completedTransaction = await this.handleTransactionFlow(transactionId, signers);

            return {
                hash: completedTransaction.onChain?.txId ?? "",
            };
        } catch (error) {
            throw new Error(`Failed to send raw transaction: ${error}`);
        }
    }

    async registerDelegatedSigner(signer: string): Promise<SolanaDelegatedSignerResponse> {
        try {
            const response = (await this.#api.registerDelegatedSigner(
                this.#locator,
                signer,
            )) as SolanaDelegatedSignerResponse;

            if (!("transaction" in response) || !response.transaction) {
                throw new Error(
                    `Expected transaction in response for non-custodial delegated signer registration. Response: ${JSON.stringify(response)}`,
                );
            }

            const transactionId = response.transaction.id;

            // For delegated signer registration, only the admin signer is needed
            const signers = this.#adminSigner.type === "solana-keypair" ? [this.#adminSigner.keypair] : [];

            // Handle transaction flow
            await this.handleTransactionFlow(transactionId, signers, "Delegated signer registration");

            return response;
        } catch (error) {
            throw new Error(`Failed to register delegated signer: ${error}`);
        }
    }

    async getDelegatedSigner(signerLocator: string): Promise<SolanaDelegatedSignerResponse> {
        try {
            return (await this.#api.getDelegatedSigner(this.#locator, signerLocator)) as SolanaDelegatedSignerResponse;
        } catch (error) {
            throw new Error(`Failed to get delegated signer info: ${error}`);
        }
    }
}

export function solanaSmartWalletFactory(crossmintClient: CrossmintApiClient) {
    const walletsApi = new CrossmintWalletsAPI(crossmintClient);
    return async function solanaSmartWallet(options: SolanaSmartWalletOptions) {
        const locator = getLocator(options.address, options.linkedUser);
        let address: string;

        if (options.address) {
            const wallet = await walletsApi.getWallet(locator);
            address = wallet.address;
        } else {
            const wallet = await walletsApi.createSmartWallet(options.config.adminSigner, "solana-smart-wallet");
            address = wallet.address;
        }

        return new SolanaSmartWalletClient(walletsApi, address, options);
    };
}
