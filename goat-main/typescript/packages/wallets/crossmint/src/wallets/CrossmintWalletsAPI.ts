import type { CrossmintApiClient } from "@crossmint/common-sdk-base";
import type { EVMTypedData } from "@goat-sdk/wallet-evm";
import { Keypair } from "@solana/web3.js";
import type { SupportedSmartWalletChains } from "../chains";

type CoreSignerType =
    | "evm-keypair"
    | "solana-keypair"
    | "webauthn"
    | "evm-fireblocks-custodial"
    | "solana-fireblocks-custodial"
    | "evm-keypair-session";

type AdminSigner = {
    type: CoreSignerType;
    address?: string;
    locator?: string;
};

////////////////////////////////////////////////////////////////////
// Create Wallet
////////////////////////////////////////////////////////////////////
interface CreateWalletRequest {
    type: "evm-smart-wallet" | "solana-custodial-wallet" | "solana-smart-wallet";
    config?: {
        adminSigner?: AdminSigner;
    };
    linkedUser?: string;
}

interface CreateWalletResponse {
    type: "evm-smart-wallet" | "solana-custodial-wallet" | "solana-smart-wallet";
    address: string;
    config: {
        adminSigner?: AdminSigner;
    };
    linkedUser?: string;
    createdAt: string;
}

////////////////////////////////////////////////////////////////////
// Get Wallet
////////////////////////////////////////////////////////////////////
interface GetWalletResponse extends CreateWalletResponse {}

////////////////////////////////////////////////////////////////////
// Create Transaction
////////////////////////////////////////////////////////////////////
interface TransactionApprovals {
    pending: Omit<ApprovalSubmission, "signature" | "submittedAt" | "metadata">[];

    submitted: ApprovalSubmission[];
    required?: number; // For multisig scenarios, tentative until we support
}

interface ApprovalSubmission {
    signer: string; // signing locator {type}:{id}
    message: string;
    submittedAt: string; // timestamp
    signature: string;
    metadata?: object; // additional data, user agent, etc
}

interface CreateTransactionRequest {
    params: EVMTransactionParams | SolanaTransactionParams;
}

export interface CreateTransactionResponse {
    id: string;
    walletType: "evm-smart-wallet" | "solana-custodial-wallet";
    status: "awaiting-approval" | "pending" | "failed" | "success";
    approvals?: TransactionApprovals;
    params: EVMTransactionParams | SolanaTransactionParams;
    error?: {
        reason: string;
        message: string;
    };
    onChain?: {
        txId?: string;
    };
    createdAt: string;
}

interface Approval {
    signer: string;
    signature: string;
}

interface EVMTransactionParams {
    calls?: Call[];
    chain?: string;
    signer?: string;
    transaction?: string;
    signers?: string[];
}

interface SolanaTransactionParams {
    transaction: string;
    requiredSigners?: string[];
}

interface Call {
    to: string;
    value: string;
    data: string;
}

////////////////////////////////////////////////////////////////////
// Submit Approval
////////////////////////////////////////////////////////////////////
interface SubmitApproval {
    signer: string;
    signature: string;
}

interface SubmitApprovalRequest {
    approvals: SubmitApproval[];
}

interface SubmitApprovalResponse extends CreateTransactionResponse {}

////////////////////////////////////////////////////////////////////
// Sign Message
////////////////////////////////////////////////////////////////////
interface SignMessageRequest {
    type: "evm-message" | "solana-message";
    params: {
        message: string;
        signer?: string;
        chain?: string;
    };
}

interface SignMessageResponse {
    id: string;
    walletType: "evm-smart-wallet" | "solana-custodial-wallet";
    status: "awaiting-approval" | "pending" | "failed" | "success";
    outputSignature: string;
    approvals: TransactionApprovals;
    createdAt: string;
}

////////////////////////////////////////////////////////////////////
// Sign Typed Data
////////////////////////////////////////////////////////////////////
interface SignTypedDataRequest {
    type: "evm-typed-data";
    params: {
        typedData: EVMTypedData;
        chain?: string;
        signer: string;
    };
}

interface SignTypedDataResponse {
    id: string;
    type: "evm-typed-data";
    params: {
        typedData: EVMTypedData;
        chain?: string;
        signer: string;
    };
    status: "awaiting-approval" | "pending" | "failed" | "success";
    createdAt: string;
    approvals: TransactionApprovals;
}

////////////////////////////////////////////////////////////////////
// Approve Signature
////////////////////////////////////////////////////////////////////
interface ApproveSignatureRequest {
    approvals: {
        signer: string;
        signature: string;
    }[];
}

interface ApproveSignatureResponse {
    id: string;
    walletType: "evm-smart-wallet" | "solana-custodial-wallet";
    status: "awaiting-approval" | "pending" | "failed" | "success";
    outputSignature?: string;
    approvals: TransactionApprovals;
    createdAt: string;
}

////////////////////////////////////////////////////////////////////
// Register Delegated Signer
////////////////////////////////////////////////////////////////////

interface DelegatedSignerPermission {
    type: string;
    value: string;
}

interface EVMCustodialDelegatedSignerResponse {
    type: "evm-fireblocks-custodial";
    address: string;
    locator: string;
}

interface ChainStatus {
    status: "active" | "awaiting-approval";
    id?: string;
    approvals?: {
        pending: {
            signer: string;
            message: string;
        }[];
        submitted: {
            signer: string;
            message: string;
            signature: string;
            submittedAt: string;
        }[];
    };
}

interface EVMNonCustodialDelegatedSignerResponse {
    type: "evm-keypair";
    address: string;
    locator: string;
    chains: {
        [chainName: string]: ChainStatus;
    };
}

export type EVMDelegatedSignerResponse = EVMCustodialDelegatedSignerResponse | EVMNonCustodialDelegatedSignerResponse;

interface SolanaCustodialDelegatedSignerResponse {
    type: "solana-fireblocks-custodial";
    address: string;
    locator: string;
}

interface SolanaNonCustodialDelegatedSignerResponse {
    type: "solana-keypair";
    address: string;
    locator: string;
    transaction: {
        onChain: {
            transaction: string;
            lastValidBlockHeight?: number;
        };
        id: string;
        status: "awaiting-approval" | "pending" | "failed" | "success";
        approvals: TransactionApprovals;
        createdAt: string;
    };
}

export type SolanaDelegatedSignerResponse =
    | SolanaCustodialDelegatedSignerResponse
    | SolanaNonCustodialDelegatedSignerResponse;

export type DelegatedSignerResponse = EVMDelegatedSignerResponse | SolanaDelegatedSignerResponse;

////////////////////////////////////////////////////////////////////
// API
////////////////////////////////////////////////////////////////////

interface ActionResponse {
    status: "pending" | "succeeded" | "failed";
    data: Record<string, unknown>;
}

type APIResponse =
    | CreateWalletResponse
    | CreateTransactionResponse
    | GetWalletResponse
    | SubmitApprovalResponse
    | SignMessageResponse
    | SignTypedDataResponse
    | ApproveSignatureResponse
    | DelegatedSignerResponse
    | ActionResponse;

export class CrossmintWalletsAPI {
    private baseUrl: string;
    private crossmintClient: CrossmintApiClient;

    constructor(crossmintClient: CrossmintApiClient) {
        this.crossmintClient = crossmintClient;
        this.baseUrl = `${crossmintClient.baseUrl}/api/v1-alpha2`;
    }

    /**
     * Makes an HTTP request to the Crossmint API.
     *
     * @param endpoint - The API endpoint (relative to baseUrl).
     * @param options - Fetch options including method, headers, and body.
     * @returns The parsed JSON response.
     * @throws An error if the response is not OK.
     */
    private async request<T extends APIResponse>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;

        // Set default headers and merge with any additional headers
        const headers = new Headers({
            ...this.crossmintClient.authHeaders,
            ...(options.headers || {}),
            "Content-Type": "application/json",
        });

        const response = await fetch(url, { ...options, headers });
        const responseBody = (await response.json()) as T;

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${JSON.stringify(responseBody)}`);
        }

        return responseBody;
    }

    public async createSmartWallet(
        adminSigner?: AdminSigner,
        type: "evm-smart-wallet" | "solana-smart-wallet" = "evm-smart-wallet",
    ): Promise<CreateWalletResponse> {
        const endpoint = "/wallets";
        const payload: CreateWalletRequest = {
            type,
            config: {
                adminSigner: adminSigner,
            },
        };

        return this.request<CreateWalletResponse>(endpoint, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    }

    public async createCustodialWallet(linkedUser: string): Promise<CreateWalletResponse> {
        const endpoint = "/wallets";
        const payload: CreateWalletRequest = {
            type: "solana-custodial-wallet",
            linkedUser: linkedUser,
        };

        return this.request<CreateWalletResponse>(endpoint, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    }

    public async getWallet(locator: string): Promise<GetWalletResponse> {
        const endpoint = `/wallets/${encodeURIComponent(locator)}`;
        return this.request<GetWalletResponse>(endpoint, {
            method: "GET",
        });
    }

    public async signMessageForCustodialWallet(locator: string, message: string): Promise<SignMessageResponse> {
        const endpoint = `/wallets/${encodeURIComponent(locator)}/signatures`;
        const payload: SignMessageRequest = {
            type: "solana-message",
            params: { message },
        };

        return this.request<SignMessageResponse>(endpoint, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    }

    public async signMessageForSmartWallet(
        walletAddress: string,
        message: string,
        chain: SupportedSmartWalletChains,
        signer?: string,
    ): Promise<SignMessageResponse> {
        const endpoint = `/wallets/${encodeURIComponent(walletAddress)}/signatures`;
        const payload: SignMessageRequest = {
            type: "evm-message",
            params: {
                message,
                signer,
                chain,
            },
        };

        return this.request<SignMessageResponse>(endpoint, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    }

    public async signTypedDataForSmartWallet(
        walletAddress: string,
        typedData: EVMTypedData,
        chain: SupportedSmartWalletChains,
        signer: string,
    ): Promise<SignTypedDataResponse> {
        const endpoint = `/wallets/${encodeURIComponent(walletAddress)}/signatures`;

        const payload: SignTypedDataRequest = {
            type: "evm-typed-data",
            params: {
                typedData,
                chain,
                signer,
            },
        };

        return this.request<SignTypedDataResponse>(endpoint, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    }

    public async checkSignatureStatus(signatureId: string, walletAddress: string): Promise<ApproveSignatureResponse> {
        const endpoint = `/wallets/${encodeURIComponent(walletAddress)}/signatures/${encodeURIComponent(signatureId)}`;
        return this.request<ApproveSignatureResponse>(endpoint, {
            method: "GET",
        });
    }

    public async approveSignatureForSmartWallet(
        signatureId: string,
        locator: string,
        signer: string,
        signature: string,
    ): Promise<ApproveSignatureResponse> {
        const endpoint = `/wallets/${encodeURIComponent(
            locator,
        )}/signatures/${encodeURIComponent(signatureId)}/approvals`;

        const payload: ApproveSignatureRequest = {
            approvals: [
                {
                    signer: signer,
                    signature: signature,
                },
            ],
        };

        return this.request<ApproveSignatureResponse>(endpoint, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    }

    public async createSolanaTransaction(
        locator: string,
        transaction: string,
        signer?: Keypair,
        requiredSigners?: string[],
    ): Promise<CreateTransactionResponse> {
        const endpoint = `/wallets/${encodeURIComponent(locator)}/transactions`;
        const payload: CreateTransactionRequest = {
            params: {
                transaction: transaction,
                ...(signer ? { signer: `solana-keypair:${signer.publicKey.toBase58()}` } : {}),
                ...(requiredSigners ? { requiredSigners } : {}),
            },
        };

        return this.request<CreateTransactionResponse>(endpoint, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    }

    public async createEVMTransaction(
        walletAddress: string,
        calls: Call[],
        chain: SupportedSmartWalletChains,
        signer?: string,
    ): Promise<CreateTransactionResponse> {
        const endpoint = `/wallets/${encodeURIComponent(walletAddress)}/transactions`;
        const payload: CreateTransactionRequest = {
            params: {
                calls,
                chain,
                ...(signer ? { signer: `evm-keypair:${signer}` } : {}),
            },
        };

        return this.request<CreateTransactionResponse>(endpoint, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    }

    public async approveTransaction(
        locator: string,
        transactionId: string,
        approvals: SubmitApproval[],
    ): Promise<SubmitApprovalResponse> {
        const endpoint = `/wallets/${encodeURIComponent(
            locator,
        )}/transactions/${encodeURIComponent(transactionId)}/approvals`;

        const payload: SubmitApprovalRequest = {
            approvals,
        };

        return this.request<SubmitApprovalResponse>(endpoint, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    }

    public async checkTransactionStatus(locator: string, transactionId: string): Promise<CreateTransactionResponse> {
        const endpoint = `/wallets/${encodeURIComponent(locator)}/transactions/${encodeURIComponent(transactionId)}`;

        return this.request<CreateTransactionResponse>(endpoint, {
            method: "GET",
        });
    }

    public async waitForTransaction(
        locator: string,
        transactionId: string,
        options: { interval?: number; maxAttempts?: number } = {},
    ): Promise<CreateTransactionResponse> {
        const interval = options.interval || 1000;
        const maxAttempts = options.maxAttempts || 30;
        let attempts = 0;

        while (attempts < maxAttempts) {
            const status = await this.checkTransactionStatus(locator, transactionId);
            if (status.status === "success" || status.status === "failed") {
                return status;
            }
            attempts++;
            await new Promise((resolve) => setTimeout(resolve, interval));
        }

        throw new Error("Timed out waiting for transaction");
    }

    public async waitForSignature(
        locator: string,
        signatureId: string,
        options: { interval?: number; maxAttempts?: number } = {},
    ): Promise<ApproveSignatureResponse> {
        const interval = options.interval || 1000;
        const maxAttempts = options.maxAttempts || 30;
        let attempts = 0;

        while (attempts < maxAttempts) {
            const status = await this.checkSignatureStatus(signatureId, locator);
            if (status.status === "success" || status.status === "failed") {
                return status;
            }
            attempts++;
            await new Promise((resolve) => setTimeout(resolve, interval));
        }

        throw new Error("Timed out waiting for signature");
    }

    public async waitForAction(
        actionId: string,
        options: { interval?: number; maxAttempts?: number } = {},
    ): Promise<ActionResponse> {
        const interval = options.interval || 1000;
        const maxAttempts = options.maxAttempts || 30;
        let attempts = 0;

        while (attempts < maxAttempts) {
            const response = await this.request<ActionResponse>(`/2022-06-09/actions/${encodeURIComponent(actionId)}`, {
                method: "GET",
            });
            if (response.status === "succeeded" || response.status === "failed") {
                return response;
            }
            attempts++;
            await new Promise((resolve) => setTimeout(resolve, interval));
        }

        throw new Error("Timed out waiting for action");
    }

    public async registerDelegatedSigner(
        walletLocator: string,
        signer: string,
        chain?: string,
        expiresAt?: number,
        permissions?: DelegatedSignerPermission[],
    ): Promise<DelegatedSignerResponse> {
        const endpoint = `/wallets/${encodeURIComponent(walletLocator)}/signers`;
        const payload: Record<string, string | DelegatedSignerPermission[]> = {
            signer,
        };

        if (chain) {
            payload.chain = chain;
        }

        if (expiresAt) {
            payload.expiresAt = expiresAt.toString();
        }

        if (permissions && permissions.length > 0) {
            payload.permissions = permissions.map((permission) => ({
                type: permission.type,
                value: permission.value,
            }));
        }

        return this.request(endpoint, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    }

    public async getDelegatedSigner(walletLocator: string, signer: string): Promise<DelegatedSignerResponse> {
        const endpoint = `/wallets/${encodeURIComponent(walletLocator)}/signers/${encodeURIComponent(signer)}`;
        return this.request(endpoint, {
            method: "GET",
        });
    }
}
