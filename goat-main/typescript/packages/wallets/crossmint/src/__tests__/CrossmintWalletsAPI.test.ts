import type { CrossmintApiClient } from "@crossmint/common-sdk-base";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SupportedSmartWalletChains } from "../chains";
import { CrossmintWalletsAPI } from "../wallets/CrossmintWalletsAPI";

// Mock fetch
const mockFetch = vi.fn();

beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
});

// Helper to mock fetch response
const mockFetchResponse = (response: unknown, status = 200, ok = true) => {
    const mockResponse = {
        ok,
        status,
        statusText: ok ? "OK" : "Error",
        json: () => Promise.resolve(response),
    } as Response;

    if (!ok) {
        mockFetch.mockRejectedValueOnce(new Error(`Error ${status}: ${JSON.stringify(response)}`));
    } else {
        mockFetch.mockResolvedValueOnce(mockResponse);
    }
};

// Helper to get mock call args
const getMockCallArgs = (callIndex = 0): RequestInit => {
    return mockFetch.mock.calls[callIndex][1] as RequestInit;
};

// Test utility to access private request method
const makeRequest = async (api: CrossmintWalletsAPI, endpoint: string, options?: RequestInit) => {
    return (
        api as unknown as {
            request: (endpoint: string, options?: RequestInit) => Promise<unknown>;
        }
    ).request(endpoint, options);
};

describe("CrossmintWalletsAPI", () => {
    let api: CrossmintWalletsAPI;
    const mockCrossmintClient = {
        baseUrl: "https://staging.crossmint.com",
        authHeaders: { "x-api-key": "test-key" },
    } as CrossmintApiClient;

    beforeEach(() => {
        api = new CrossmintWalletsAPI(mockCrossmintClient);
        mockFetch.mockReset();
        vi.stubGlobal("fetch", mockFetch);
    });

    describe("Wallet Management", () => {
        describe("Smart Wallet Operations", () => {
            it("should get wallet details", async () => {
                const mockResponse = {
                    type: "evm-smart-wallet",
                    address: "0x123",
                    config: {},
                    createdAt: "2024-01-01",
                };
                mockFetchResponse(mockResponse);

                const result = await api.getWallet("evm-smart-wallet:0x123");
                expect(result).toEqual(mockResponse);
                expect(getMockCallArgs().method).toBe("GET");
            });

            it("should create a smart wallet", async () => {
                const mockResponse = {
                    type: "evm-smart-wallet",
                    address: "0x123",
                    config: {},
                    createdAt: "2024-01-01",
                };
                mockFetchResponse(mockResponse);

                const result = await api.createSmartWallet();
                expect(result).toEqual(mockResponse);
            });
        });

        describe("Solana Smart Wallet Operations", () => {
            it("should create a Solana smart wallet", async () => {
                const mockResponse = {
                    type: "solana-smart-wallet",
                    address: "solana123",
                    linkedUser: "user@test.com",
                    createdAt: "2024-01-01",
                };
                mockFetchResponse(mockResponse);

                const result = await api.createSmartWallet(undefined, "solana-smart-wallet");
                expect(result).toEqual(mockResponse);
            });

            it("should sign Solana messages", async () => {
                const mockResponse = {
                    id: "sig123",
                    type: "solana-message",
                    status: "completed",
                    outputSignature: "solanaSignature",
                    createdAt: "2024-01-01",
                };
                mockFetchResponse(mockResponse);

                // @ts-ignore - Using solana chain for testing
                const result = await api.signMessageForSmartWallet("solana123", "Hello Solana", "solana");
                expect(result).toEqual(mockResponse);
            });

            it("should handle Solana transactions", async () => {
                const mockResponse = {
                    id: "tx123",
                    type: "solana-smart-wallet",
                    status: "pending",
                    params: {
                        transaction: "base58encodedtransaction",
                    },
                    createdAt: "2024-01-01",
                };
                mockFetchResponse(mockResponse);

                // @ts-ignore - Using solana chain for testing
                const result = await api.createEVMTransaction("solana123", "base58encodedtransaction", "solana");
                expect(result).toEqual(mockResponse);
            });
        });

        describe("Custodial Solana Wallet Operations", () => {
            it("should create a custodial wallet", async () => {
                const mockResponse = {
                    type: "solana-custodial-wallet",
                    address: "solana123",
                    linkedUser: "user@test.com",
                    createdAt: "2024-01-01",
                };
                mockFetchResponse(mockResponse);

                const result = await api.createCustodialWallet("user@test.com");
                expect(result).toEqual(mockResponse);
            });

            it("should handle encoded Solana transactions", async () => {
                const mockResponse = {
                    id: "tx123",
                    walletType: "solana-custodial-wallet",
                    status: "pending",
                    params: {
                        transaction: "base58encodedtransaction",
                    },
                    createdAt: "2024-01-01",
                };
                mockFetchResponse(mockResponse);

                const result = await api.createSolanaTransaction("solana:custodial123", "base58encodedtransaction");
                expect(result).toEqual(mockResponse);

                const args = getMockCallArgs();
                expect(args.method).toBe("POST");
                expect(JSON.parse(args.body as string)).toEqual({
                    params: {
                        transaction: "base58encodedtransaction",
                    },
                });
            });

            it("should verify Solana message signatures", async () => {
                const mockResponse = {
                    id: "sig123",
                    walletType: "solana-custodial-wallet",
                    status: "completed",
                    outputSignature: "solanaSignature",
                    approvals: {
                        pending: [],
                        submitted: [],
                    },
                    createdAt: "2024-01-01",
                };
                mockFetchResponse(mockResponse);

                const result = await api.signMessageForCustodialWallet("solana:custodial123", "Hello Solana");
                expect(result).toEqual(mockResponse);

                const args = getMockCallArgs();
                expect(args.method).toBe("POST");
                expect(JSON.parse(args.body as string)).toEqual({
                    type: "solana-message",
                    params: {
                        message: "Hello Solana",
                    },
                });
            });

            it("should handle Solana-specific errors", async () => {
                const errorResponse = {
                    error: "Invalid transaction",
                    message: "Transaction verification failed",
                };
                mockFetchResponse(errorResponse, 400, false);

                await expect(api.createSolanaTransaction("solana:custodial123", "invalidTransaction")).rejects.toThrow(
                    /Error 400/,
                );
            });
        });
    });

    describe("EVM Smart Wallet Transaction Operations", () => {
        it("should create and sign a transaction with chain parameters", async () => {
            const mockResponse = {
                id: "tx123",
                walletType: "evm-smart-wallet",
                status: "pending",
                params: {
                    calls: [
                        {
                            to: "0x456",
                            value: "0",
                            data: "0x0",
                        },
                    ],
                    chain: "polygon",
                },
                createdAt: "2024-01-01",
            };
            mockFetchResponse(mockResponse);

            const result = await api.createEVMTransaction(
                "0x123",
                [
                    {
                        to: "0x456",
                        value: "0",
                        data: "0x0",
                    },
                ],
                "polygon" as SupportedSmartWalletChains,
            );
            expect(result).toEqual(mockResponse);

            const args = getMockCallArgs();
            expect(args.method).toBe("POST");
            expect(JSON.parse(args.body as string)).toEqual({
                params: {
                    calls: [
                        {
                            to: "0x456",
                            value: "0",
                            data: "0x0",
                        },
                    ],
                    chain: "polygon",
                },
            });
        });

        it("should handle multi-signature transaction approvals", async () => {
            const mockResponse = {
                id: "tx123",
                walletType: "evm-smart-wallet",
                status: "pending",
                params: {
                    calls: [
                        {
                            to: "0x456",
                            value: "0",
                            data: "0x0",
                        },
                    ],
                    chain: "base",
                },
                approvals: {
                    submitted: [
                        { signer: "0x123", signature: "0xsig1" },
                        { signer: "0x456", signature: "0xsig2" },
                    ],
                    pending: [{ signer: "0x789" }],
                    required: 3,
                },
                createdAt: "2024-01-01",
            };
            mockFetchResponse(mockResponse);

            const result = await api.approveTransaction("0x123", "tx123", [
                { signer: "0x123", signature: "0xsig1" },
                { signer: "0x456", signature: "0xsig2" },
            ]);
            expect(result).toEqual(mockResponse);

            const args = getMockCallArgs();
            expect(args.method).toBe("POST");
            expect(JSON.parse(args.body as string)).toEqual({
                approvals: [
                    { signer: "0x123", signature: "0xsig1" },
                    { signer: "0x456", signature: "0xsig2" },
                ],
            });
        });

        it("should handle batch transactions", async () => {
            const mockResponse = {
                id: "tx123",
                walletType: "evm-smart-wallet",
                status: "pending",
                params: {
                    calls: [
                        {
                            to: "0x456",
                            value: "1000000000000000000",
                            data: "0x0",
                        },
                        {
                            to: "0x789",
                            value: "0",
                            data: "0xa9059cbb0000000000000000000000001234567890abcdef1234567890abcdef12345678",
                        },
                    ],
                    chain: "base",
                },
                createdAt: "2024-01-01",
            };
            mockFetchResponse(mockResponse);

            const result = await api.createEVMTransaction(
                "0x123",
                [
                    {
                        to: "0x456",
                        value: "1000000000000000000", // 1 ETH
                        data: "0x0",
                    },
                    {
                        to: "0x789",
                        value: "0",
                        data: "0xa9059cbb0000000000000000000000001234567890abcdef1234567890abcdef12345678", // ERC20 transfer
                    },
                ],
                "base",
            );
            expect(result).toEqual(mockResponse);

            const args = getMockCallArgs();
            expect(args.method).toBe("POST");
            expect(JSON.parse(args.body as string)).toEqual({
                params: {
                    calls: [
                        {
                            to: "0x456",
                            value: "1000000000000000000",
                            data: "0x0",
                        },
                        {
                            to: "0x789",
                            value: "0",
                            data: "0xa9059cbb0000000000000000000000001234567890abcdef1234567890abcdef12345678",
                        },
                    ],
                    chain: "base",
                },
            });
        });

        it("should handle EVM-specific errors", async () => {
            const errorResponse = {
                error: "Invalid transaction",
                message: "Insufficient balance for gas * price + value",
            };
            mockFetchResponse(errorResponse, 400, false);

            await expect(
                api.createEVMTransaction(
                    "0x123",
                    [
                        {
                            to: "0x456",
                            value: "1000000000000000000000", // 1000 ETH
                            data: "0x0",
                        },
                    ],
                    "base" as SupportedSmartWalletChains,
                ),
            ).rejects.toThrow(/Error 400/);
        });

        it("should validate EVM chain parameters", async () => {
            const errorResponse = {
                error: "Invalid chain",
                message: "Unsupported chain specified",
            };
            mockFetchResponse(errorResponse, 400, false);

            await expect(
                api.createEVMTransaction(
                    "0x123",
                    [
                        {
                            to: "0x456",
                            value: "0",
                            data: "0x0",
                        },
                    ],
                    "base" as SupportedSmartWalletChains,
                ),
            ).rejects.toThrow(/Error 400/);
        });
    });

    describe("Signing Operations", () => {
        it("should sign typed data", async () => {
            const mockTypedData = {
                types: {
                    EIP712Domain: [
                        { name: "name", type: "string" },
                        { name: "version", type: "string" },
                    ],
                    Message: [{ name: "content", type: "string" }],
                },
                primaryType: "Message",
                domain: {
                    name: "Test App",
                    version: "1",
                },
                message: {
                    content: "Hello World",
                },
            };

            const mockResponse = {
                id: "sig123",
                type: "evm-typed-data",
                status: "completed",
                params: {
                    typedData: mockTypedData,
                    chain: "polygon",
                    signer: "evm-keypair:0x123",
                },
                createdAt: "2024-01-01",
            };
            mockFetchResponse(mockResponse);

            const result = await api.signTypedDataForSmartWallet(
                "0x123",
                mockTypedData,
                "polygon" as SupportedSmartWalletChains,
                "evm-keypair:0x123",
            );
            expect(result).toEqual(mockResponse);
        });

        it("should sign a message", async () => {
            const mockResponse = {
                id: "sig123",
                walletType: "evm-smart-wallet",
                status: "completed",
                outputSignature: "0xsig",
                approvals: {
                    pending: [],
                    submitted: [],
                },
                createdAt: "2024-01-01",
            };
            mockFetchResponse(mockResponse);

            const result = await api.signMessageForSmartWallet(
                "0x123",
                "Hello",
                "polygon" as SupportedSmartWalletChains,
            );
            expect(result).toEqual(mockResponse);
        });
    });

    describe("NFT Operations", () => {
        it("should get all collections", async () => {
            const mockResponse = {
                collections: [
                    {
                        id: "col123",
                        name: "Test Collection",
                        chain: "polygon",
                    },
                ],
            };
            mockFetchResponse(mockResponse);

            const result = await makeRequest(api, "/2022-06-09/collections/");
            expect(result).toEqual(mockResponse);
        });

        it("should create a collection", async () => {
            const mockResponse = {
                id: "col123",
                actionId: "action123",
                chain: "ethereum",
            };
            mockFetchResponse(mockResponse);

            const result = await makeRequest(api, "/2022-06-09/collections/", {
                method: "POST",
                body: JSON.stringify({
                    metadata: {
                        name: "Test Collection",
                        description: "Test Description",
                    },
                }),
            });
            expect(result).toEqual(mockResponse);
        });

        it("should mint an NFT", async () => {
            const mockResponse = {
                id: "nft123",
                actionId: "action123",
                onChain: {
                    contractAddress: "0x123",
                },
            };
            mockFetchResponse(mockResponse);

            const result = await makeRequest(api, "/2022-06-09/collections/col123/nfts", {
                method: "POST",
                body: JSON.stringify({
                    recipient: "recipient@test.com",
                    metadata: {
                        name: "Test NFT",
                        description: "Test NFT Description",
                        image: "https://test.com/image.png",
                    },
                }),
            });
            expect(result).toEqual(mockResponse);
        });
    });

    describe("Faucet Operations", () => {
        it("should request faucet tokens", async () => {
            const mockResponse = {
                status: "success",
                message: "Balance topped up successfully",
            };
            mockFetchResponse(mockResponse);

            const result = await makeRequest(api, "/wallets/0x123/balances", {
                method: "POST",
                body: JSON.stringify({
                    amount: 10,
                    currency: "usdc",
                    chain: "ethereum-sepolia",
                }),
            });
            expect(result).toEqual(mockResponse);
        });
    });

    describe("Async Operations", () => {
        it("should poll transaction status until completion", async () => {
            // Mock sequential responses
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: () =>
                        Promise.resolve({
                            id: "tx123",
                            status: "pending",
                            hash: null,
                        }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: () =>
                        Promise.resolve({
                            id: "tx123",
                            status: "success",
                            onChain: {
                                txId: "0xhash123",
                            },
                        }),
                });

            const result = await api.waitForTransaction("wallet123", "tx123", {
                interval: 100,
                maxAttempts: 2,
            });
            expect(result.status).toBe("success");
            expect(result.onChain?.txId).toBe("0xhash123");
        });

        it("should poll signature verification until completion", async () => {
            // Mock sequential responses
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: () =>
                        Promise.resolve({
                            id: "sig123",
                            status: "pending",
                            outputSignature: null,
                        }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: () =>
                        Promise.resolve({
                            id: "sig123",
                            status: "success",
                            outputSignature: "0xsig123",
                        }),
                });

            const result = await api.waitForSignature("wallet123", "sig123", {
                interval: 100,
                maxAttempts: 2,
            });
            expect(result.status).toBe("success");
            expect(result.outputSignature).toBe("0xsig123");
        });

        it("should wait for action completion", async () => {
            // Mock sequential responses
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: () =>
                        Promise.resolve({
                            status: "pending",
                            data: null,
                        }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: () =>
                        Promise.resolve({
                            status: "succeeded",
                            data: {
                                result: "success",
                            },
                        }),
                });

            const result = await api.waitForAction("action123", {
                interval: 100,
                maxAttempts: 2,
            });
            expect(result.status).toBe("succeeded");
            expect(result.data.result).toBe("success");
        });

        it("should handle timeout during transaction polling", async () => {
            // Always return pending
            mockFetch.mockImplementation(() =>
                Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () =>
                        Promise.resolve({
                            id: "tx123",
                            status: "pending",
                            hash: null,
                        }),
                }),
            );

            await expect(
                api.waitForTransaction("wallet123", "tx123", {
                    interval: 100,
                    maxAttempts: 2,
                }),
            ).rejects.toThrow(/Timed out waiting for transaction/);
        });

        it("should handle timeout during signature verification", async () => {
            // Always return pending
            mockFetch.mockImplementation(() =>
                Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () =>
                        Promise.resolve({
                            id: "sig123",
                            status: "pending",
                            outputSignature: null,
                        }),
                }),
            );

            await expect(
                api.waitForSignature("wallet123", "sig123", {
                    interval: 100,
                    maxAttempts: 2,
                }),
            ).rejects.toThrow(/Timed out waiting for signature/);
        });

        it("should handle timeout during action completion", async () => {
            // Always return pending
            mockFetch.mockImplementation(() =>
                Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () =>
                        Promise.resolve({
                            status: "pending",
                            data: null,
                        }),
                }),
            );

            await expect(
                api.waitForAction("action123", {
                    interval: 100,
                    maxAttempts: 2,
                }),
            ).rejects.toThrow(/Timed out waiting for action/);
        });
    });

    describe("Multiple Approvals", () => {
        it("should handle multiple transaction approvals", async () => {
            const mockResponse = {
                id: "tx123",
                status: "success",
                approvals: {
                    submitted: [
                        { signer: "signer1", signature: "sig1" },
                        { signer: "signer2", signature: "sig2" },
                    ],
                    pending: [],
                },
            };
            mockFetchResponse(mockResponse);

            const result = await api.approveTransaction("wallet123", "tx123", [
                { signer: "signer1", signature: "sig1" },
                { signer: "signer2", signature: "sig2" },
            ]);
            expect(result).toEqual(mockResponse);
        });
    });

    describe("Error Handling", () => {
        it("should handle invalid parameters", async () => {
            const errorResponse = {
                error: "Invalid request",
                message: "Missing required parameter: chain",
            };
            mockFetchResponse(errorResponse, 400, false);

            await expect(
                api.createEVMTransaction(
                    "0x123",
                    [
                        {
                            to: "0x456",
                            value: "0",
                            data: "0x0",
                        },
                    ],
                    null as unknown as SupportedSmartWalletChains, // Missing required chain parameter
                ),
            ).rejects.toThrow(/Missing required parameter/);
        });

        it("should handle rate limiting", async () => {
            const errorResponse = {
                error: "Too Many Requests",
                message: "Rate limit exceeded. Please try again in 60 seconds.",
                retryAfter: 60,
            };
            mockFetchResponse(errorResponse, 429, false);

            await expect(api.createSmartWallet()).rejects.toThrow(/Rate limit exceeded/);
        });

        it("should handle network errors", async () => {
            mockFetch.mockRejectedValue(new Error("Network error: Connection refused"));
            await expect(api.createSmartWallet()).rejects.toThrow(/Connection refused/);
        });

        it("should handle timeout errors", async () => {
            mockFetch.mockRejectedValue(new Error("Request timed out after 30 seconds"));
            await expect(api.createSmartWallet()).rejects.toThrow(/timed out/);
        });

        it("should handle chain validation errors", async () => {
            const errorResponse = {
                error: "Chain validation failed",
                message: "Chain 'invalid-chain' is not supported. Supported chains are: base, polygon, optimism",
                supportedChains: ["base", "polygon", "optimism"],
            };
            mockFetchResponse(errorResponse, 400, false);

            await expect(
                api.createEVMTransaction(
                    "0x123",
                    [
                        {
                            to: "0x456",
                            value: "0",
                            data: "0x0",
                        },
                    ],
                    "base" as SupportedSmartWalletChains, // Using valid chain to test validation
                ),
            ).rejects.toThrow(/Chain validation failed/);
        });
    });
});
