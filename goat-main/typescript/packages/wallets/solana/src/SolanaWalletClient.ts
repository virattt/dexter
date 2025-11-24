import { type Balance, type SolanaChain, type ToolBase, WalletClientBase, createTool } from "@goat-sdk/core";
import {
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    createAssociatedTokenAccountInstruction,
    createTransferCheckedInstruction,
    getAssociatedTokenAddressSync,
    getMint,
} from "@solana/spl-token";
import {
    AddressLookupTableAccount,
    type Connection,
    type Keypair,
    PublicKey,
    SystemProgram,
    type TransactionInstruction,
    TransactionMessage,
    type VersionedTransaction,
} from "@solana/web3.js";
import { formatUnits, parseUnits } from "viem";
import {
    convertFromBaseUnitsParametersSchema,
    convertToBaseUnitsParametersSchema,
    getTokenInfoBySymbolParametersSchema,
    sendTokenParametersSchema,
} from "./params.js";
import { SPL_TOKENS, type SolanaNetwork, type Token } from "./tokens.js";
import type { SolanaTransaction } from "./types";
import { doesAccountExist } from "./utils.js";

export type SolanWalletClientCtorParams = {
    connection: Connection;
    network?: SolanaNetwork;
    tokens?: Token[];
    enableSend?: boolean;
};

export abstract class SolanaWalletClient extends WalletClientBase {
    protected connection: Connection;
    protected network: SolanaNetwork;
    protected tokens: Token[];
    protected enableSend: boolean;

    constructor(params: SolanWalletClientCtorParams) {
        super();
        this.connection = params.connection;
        this.network = params.network || "mainnet";
        this.tokens = params.tokens || SPL_TOKENS[this.network] || [];
        this.enableSend = params.enableSend !== false;
    }

    getChain(): SolanaChain {
        return {
            type: "solana",
            nativeCurrency: {
                name: "Solana",
                symbol: "SOL",
                decimals: 9,
            },
        };
    }

    getConnection() {
        return this.connection;
    }

    async balanceOf(address: string, tokenAddress?: string): Promise<Balance> {
        const ownerPublicKey = new PublicKey(address);

        if (tokenAddress) {
            const mintPublicKey = new PublicKey(tokenAddress);
            try {
                const tokenAccount = getAssociatedTokenAddressSync(
                    mintPublicKey,
                    ownerPublicKey,
                    true,
                    TOKEN_PROGRAM_ID,
                    ASSOCIATED_TOKEN_PROGRAM_ID,
                );

                let balanceInBaseUnits = "0";
                const accountExists = await doesAccountExist(this.connection, tokenAccount);

                if (accountExists) {
                    const balanceResponse = await this.connection.getTokenAccountBalance(tokenAccount);
                    balanceInBaseUnits = balanceResponse.value.amount;
                }

                const configuredToken = this.tokens.find((t) => t.mintAddress === tokenAddress);

                const decimals = configuredToken?.decimals || 9;
                const symbol = configuredToken?.symbol || "TOKEN";
                const name = configuredToken?.name || "Unknown Token";
                const value = formatUnits(BigInt(balanceInBaseUnits), decimals);

                return {
                    decimals,
                    symbol,
                    name,
                    value,
                    inBaseUnits: balanceInBaseUnits,
                };
            } catch (error) {
                console.error(`Failed to fetch SPL token balance for ${tokenAddress}: ${error}`);
                throw new Error(
                    `Failed to fetch balance for token ${tokenAddress}: ${error instanceof Error ? error.message : String(error)}`,
                );
            }
        } else {
            const balance = await this.connection.getBalance(ownerPublicKey);
            const chain = this.getChain();

            return {
                decimals: chain.nativeCurrency.decimals,
                symbol: chain.nativeCurrency.symbol,
                name: chain.nativeCurrency.name,
                value: formatUnits(BigInt(balance), chain.nativeCurrency.decimals),
                inBaseUnits: balance.toString(),
            };
        }
    }

    async decompileVersionedTransactionToInstructions(versionedTransaction: VersionedTransaction) {
        const lookupTableAddresses = versionedTransaction.message.addressTableLookups.map(
            (lookup) => lookup.accountKey,
        );
        const addressLookupTableAccounts = await Promise.all(
            lookupTableAddresses.map((address) =>
                this.connection.getAddressLookupTable(address).then((lookupTable) => lookupTable.value),
            ),
        );
        const nonNullAddressLookupTableAccounts = addressLookupTableAccounts.filter(
            (lookupTable) => lookupTable != null,
        );
        const decompileArgs = {
            addressLookupTableAccounts: nonNullAddressLookupTableAccounts,
        };
        return TransactionMessage.decompile(versionedTransaction.message, decompileArgs).instructions;
    }

    abstract sendTransaction(transaction: SolanaTransaction, additionalSigners?: Keypair[]): Promise<{ hash: string }>;

    abstract sendRawTransaction(
        transaction: string,
        signer?: Keypair,
        additionalSigners?: Keypair[],
    ): Promise<{ hash: string }>;

    protected async getAddressLookupTableAccounts(keys: string[]): Promise<AddressLookupTableAccount[]> {
        const addressLookupTableAccountInfos = await this.connection.getMultipleAccountsInfo(
            keys.map((key) => new PublicKey(key)),
        );

        return addressLookupTableAccountInfos.reduce((acc, accountInfo, index) => {
            const addressLookupTableAddress = keys[index];
            if (accountInfo) {
                const addressLookupTableAccount = new AddressLookupTableAccount({
                    key: new PublicKey(addressLookupTableAddress),
                    state: AddressLookupTableAccount.deserialize(accountInfo.data),
                });
                acc.push(addressLookupTableAccount);
            }

            return acc;
        }, new Array<AddressLookupTableAccount>());
    }

    async sendToken(params: {
        recipient: string;
        baseUnitsAmount: string;
        tokenAddress?: string;
    }): Promise<{ hash: string }> {
        if (!this.enableSend) {
            throw new Error("Sending transactions is disabled for this wallet.");
        }

        const { recipient, baseUnitsAmount, tokenAddress } = params;
        const ownerPublicKey = new PublicKey(this.getAddress());
        const destinationPublicKey = new PublicKey(recipient);

        const instructions: TransactionInstruction[] = [];

        const amountInBaseUnits = BigInt(baseUnitsAmount);

        try {
            if (tokenAddress) {
                // --- SPL Token Transfer Logic ---
                const mintPublicKey = new PublicKey(tokenAddress);
                const mintInfo = await getMint(this.connection, mintPublicKey);
                if (!mintInfo) {
                    throw new Error(`Token with mint address ${tokenAddress} not found`);
                }

                const sourceTokenAccount = getAssociatedTokenAddressSync(
                    mintPublicKey,
                    ownerPublicKey,
                    true,
                    TOKEN_PROGRAM_ID,
                    ASSOCIATED_TOKEN_PROGRAM_ID,
                );

                const destinationTokenAccount = getAssociatedTokenAddressSync(
                    mintPublicKey,
                    destinationPublicKey,
                    true,
                    TOKEN_PROGRAM_ID,
                    ASSOCIATED_TOKEN_PROGRAM_ID,
                );

                const sourceAccountExists = await doesAccountExist(this.connection, sourceTokenAccount);
                if (!sourceAccountExists) {
                    throw new Error(`Source token account does not exist for mint ${tokenAddress}`);
                }

                const destinationAccountExists = await doesAccountExist(this.connection, destinationTokenAccount);

                if (!destinationAccountExists) {
                    instructions.push(
                        createAssociatedTokenAccountInstruction(
                            ownerPublicKey,
                            destinationTokenAccount,
                            destinationPublicKey,
                            mintPublicKey,
                            TOKEN_PROGRAM_ID,
                            ASSOCIATED_TOKEN_PROGRAM_ID,
                        ),
                    );
                }

                instructions.push(
                    createTransferCheckedInstruction(
                        sourceTokenAccount,
                        mintPublicKey,
                        destinationTokenAccount,
                        ownerPublicKey,
                        amountInBaseUnits,
                        mintInfo.decimals,
                    ),
                );
            } else {
                const transferInstruction = SystemProgram.transfer({
                    fromPubkey: ownerPublicKey,
                    toPubkey: destinationPublicKey,
                    lamports: amountInBaseUnits,
                });
                instructions.push(transferInstruction);
            }

            // Use the existing abstract sendTransaction method
            return this.sendTransaction({ instructions });
        } catch (error) {
            const assetType = tokenAddress ? `token ${tokenAddress}` : "native currency";
            console.error(`Failed to send ${assetType}: ${error}`);
            throw new Error(`Failed to send ${assetType}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async getTokenInfoBySymbol(symbol: string): Promise<Token | undefined> {
        const upperCaseSymbol = symbol.toUpperCase();
        return this.tokens.find((t) => t.symbol.toUpperCase() === upperCaseSymbol);
    }

    async _getTokenDecimals(tokenAddress?: string): Promise<number> {
        if (tokenAddress) {
            try {
                const mintInfo = await getMint(this.connection, new PublicKey(tokenAddress));
                return mintInfo.decimals;
            } catch (error) {
                console.error(`Failed to fetch decimals for token ${tokenAddress}: ${error}`);
                const configuredToken = this.tokens.find((t) => t.mintAddress === tokenAddress);
                if (configuredToken) {
                    return configuredToken.decimals;
                }
                throw new Error(
                    `Failed to fetch decimals for token ${tokenAddress}: ${error instanceof Error ? error.message : String(error)}`,
                );
            }
        }
        return this.getChain().nativeCurrency.decimals;
    }

    async convertToBaseUnits(params: {
        amount: string;
        tokenAddress?: string;
    }): Promise<string> {
        const { amount, tokenAddress } = params;
        const decimals = await this._getTokenDecimals(tokenAddress);

        try {
            const baseUnitAmount = parseUnits(amount, decimals);
            return baseUnitAmount.toString();
        } catch (error) {
            console.error(`Failed to convert amount ${amount} to base units with ${decimals} decimals: ${error}`);
            throw new Error(
                `Failed to convert amount to base units: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    async convertFromBaseUnits(params: {
        amount: string;
        tokenAddress?: string;
    }): Promise<string> {
        const { amount, tokenAddress } = params;
        const decimals = await this._getTokenDecimals(tokenAddress);

        try {
            const formattedAmount = formatUnits(BigInt(amount), decimals);
            return formattedAmount;
        } catch (error) {
            console.error(`Failed to format amount ${amount} from base units with ${decimals} decimals: ${error}`);
            throw new Error(
                `Failed to format amount from base units: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    abstract getAddress(): string;

    override getCoreTools(): ToolBase[] {
        const baseTools = super.getCoreTools();

        const commonSolanaTools: ToolBase[] = [
            createTool(
                {
                    name: "get_token_info_by_symbol",
                    description:
                        "Get information about a configured token (like mint address and decimals) by its symbol.",
                    parameters: getTokenInfoBySymbolParametersSchema,
                },
                (params) => this.getTokenInfoBySymbol(params.symbol),
            ),
            createTool(
                {
                    name: "convert_to_base_units",
                    description:
                        "Convert a token amount from human-readable units to its smallest unit (e.g., lamports).",
                    parameters: convertToBaseUnitsParametersSchema,
                },
                (params) => this.convertToBaseUnits(params),
            ),
            createTool(
                {
                    name: "convert_from_base_units",
                    description:
                        "Convert a token amount from its smallest unit (e.g., lamports) to human-readable units.",
                    parameters: convertFromBaseUnitsParametersSchema,
                },
                (params) => this.convertFromBaseUnits(params),
            ),
        ];

        const sendingSolanaTools: ToolBase[] = [];

        if (this.enableSend) {
            sendingSolanaTools.push(
                createTool(
                    {
                        name: "send_token",
                        description: "Send SOL or an SPL token to a recipient, in base units.",
                        parameters: sendTokenParametersSchema,
                    },
                    (params) => {
                        // Double check
                        if (!this.enableSend) {
                            throw new Error("Sending transactions is disabled for this wallet.");
                        }
                        return this.sendToken(params);
                    },
                ),
            );
        }

        return [...baseTools, ...commonSolanaTools, ...sendingSolanaTools];
    }
}
