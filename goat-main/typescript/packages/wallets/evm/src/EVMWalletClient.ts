import {
    type Balance,
    type EvmChain,
    type Signature,
    type ToolBase,
    WalletClientBase,
    createTool,
} from "@goat-sdk/core";
import { formatUnits, parseUnits } from "viem";
import { ERC20_ABI } from "./abi";
import {
    approveParametersSchema,
    convertFromBaseUnitsParametersSchema,
    convertToBaseUnitsParametersSchema,
    getBalanceParametersSchema,
    getTokenAllowanceParametersSchema,
    getTokenInfoByTickerParametersSchema,
    revokeApprovalParametersSchema,
    sendTokenParametersSchema,
    signTypedDataParametersSchema,
} from "./params.js";
import { PREDEFINED_TOKENS, type Token } from "./tokens";
import type { EVMReadRequest, EVMReadResult, EVMTransaction, EVMTypedData } from "./types";

// Parameter types for EVM-specific methods
export type ApproveParameters = {
    tokenAddress: `0x${string}`;
    spender: `0x${string}`;
    amount: string /* In Base Units */;
};
export type GetTokenAllowanceParameters = {
    tokenAddress: `0x${string}`;
    owner: `0x${string}`;
    spender: `0x${string}`;
};
export type TransferFromParameters = {
    tokenAddress: `0x${string}`;
    from: `0x${string}`;
    to: `0x${string}`;
    amount: string /* In Base Units */;
};

export type EVMWalletClientCtorParams = {
    tokens?: Token[];
    enableSend?: boolean;
};

export abstract class EVMWalletClient extends WalletClientBase {
    protected tokens: Token[];
    protected enableSend: boolean;

    constructor({ tokens = PREDEFINED_TOKENS, enableSend = true }: EVMWalletClientCtorParams = {}) {
        super();
        this.tokens = tokens;
        this.enableSend = enableSend;
    }

    // Abstract methods from WalletClientBase still need concrete implementation
    // getAddress, getChain, signMessage are already required by WalletClientBase

    // Abstract methods specific to EVM interaction layer
    abstract sendTransaction(transaction: EVMTransaction): Promise<{ hash: string }>;
    abstract read(request: EVMReadRequest): Promise<EVMReadResult>;
    abstract getNativeBalance(): Promise<bigint>;
    abstract signTypedData(data: EVMTypedData): Promise<Signature>;
    // Abstract method for getting native balance (needs implementation in concrete class)
    abstract getChain(): EvmChain;

    // --- Implementation of WalletClientBase abstract methods ---

    async balanceOf(address: string, tokenAddress?: `0x${string}`): Promise<Balance> {
        const chain = this.getChain();

        if (tokenAddress) {
            // ERC20 Balance
            try {
                // Fetch required info concurrently
                const [rawBalance, decimals, name, symbol] = await Promise.all([
                    this.read({
                        address: tokenAddress,
                        abi: ERC20_ABI,
                        functionName: "balanceOf",
                        args: [address],
                    }),
                    this.read({
                        address: tokenAddress,
                        abi: ERC20_ABI,
                        functionName: "decimals",
                    }),
                    this.read({
                        address: tokenAddress,
                        abi: ERC20_ABI,
                        functionName: "name",
                    }),
                    this.read({
                        address: tokenAddress,
                        abi: ERC20_ABI,
                        functionName: "symbol",
                    }),
                ]);

                // Ensure results are valid before proceeding
                if (
                    rawBalance.value === undefined ||
                    decimals.value === undefined ||
                    name.value === undefined ||
                    symbol.value === undefined
                ) {
                    throw new Error("Incomplete token information received.");
                }

                const balanceInBaseUnits = String(rawBalance.value);
                const tokenDecimals = Number(decimals.value);
                const balanceValue = formatUnits(BigInt(balanceInBaseUnits), tokenDecimals);

                return {
                    decimals: tokenDecimals,
                    symbol: String(symbol.value),
                    name: String(name.value),
                    value: balanceValue,
                    inBaseUnits: balanceInBaseUnits,
                };
            } catch (error) {
                console.error(`Failed to fetch ERC20 balance for ${tokenAddress}: ${error}`);
                throw new Error(
                    `Failed to fetch balance for token ${tokenAddress}: ${error instanceof Error ? error.message : String(error)}`,
                );
            }
        }

        // Native Balance
        try {
            const balanceInBaseUnits = await this.getNativeBalance(); // Use the new abstract method
            const nativeDecimals = 18; // Standard for EVM native currency
            const balanceValue = formatUnits(balanceInBaseUnits, nativeDecimals);

            return {
                decimals: nativeDecimals,
                symbol: chain.nativeCurrency.symbol, // Get from chain config
                name: chain.nativeCurrency.name, // Get from chain config
                value: balanceValue,
                inBaseUnits: String(balanceInBaseUnits),
            };
        } catch (error) {
            console.error(`Failed to fetch native balance: ${error}`);
            throw new Error(
                `Failed to fetch native balance: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    async getTokenInfoByTicker(ticker: string) {
        const chain = this.getChain() as EvmChain;
        const upperCaseTicker = ticker.toUpperCase();

        // Check configured tokens first
        const token = this.tokens.find((t) => t.symbol.toUpperCase() === upperCaseTicker);

        if (token) {
            const contractAddress = token.chains[chain.id]?.contractAddress;
            if (!contractAddress) {
                throw new Error(`Token ${ticker} configured but not found on chain ${chain.id}`);
            }
            // Return info from configuration
            return {
                symbol: token.symbol,
                contractAddress: contractAddress,
                decimals: token.decimals,
                name: token.name,
            };
        }

        // Check if it's the native currency symbol
        if (upperCaseTicker === chain.nativeCurrency.symbol.toUpperCase() || upperCaseTicker === "ETH") {
            return {
                symbol: chain.nativeCurrency.symbol,
                contractAddress: "", // Native currency has no contract address
                decimals: 18, // Native decimals
                name: chain.nativeCurrency.name,
            };
        }

        // Optionally: Could try fetching info directly from blockchain if ticker looks like an address?
        // For now, strictly rely on configured tokens or native symbol.

        throw new Error(`Token with ticker ${ticker} not found or not configured for chain ${chain.id}`);
    }

    async _getTokenDecimals(tokenAddress?: `0x${string}`): Promise<number> {
        if (tokenAddress) {
            try {
                const decimalsResult = await this.read({
                    address: tokenAddress,
                    abi: ERC20_ABI,
                    functionName: "decimals",
                });
                if (decimalsResult.value === undefined) {
                    throw new Error("Could not retrieve decimals.");
                }
                return Number(decimalsResult.value);
            } catch (error) {
                console.error(`Failed to fetch decimals for token ${tokenAddress}: ${error}`);
                throw new Error(
                    `Failed to fetch decimals for token ${tokenAddress}: ${error instanceof Error ? error.message : String(error)}`,
                );
            }
        }
        return 18; // Native currency decimals
    }

    async convertToBaseUnits(params: {
        amount: string;
        tokenAddress?: `0x${string}`;
    }): Promise<string> {
        const { amount, tokenAddress } = params;
        const decimals = await this._getTokenDecimals(tokenAddress);

        try {
            const numericAmount = Number.parseFloat(amount);
            if (Number.isNaN(numericAmount) || !Number.isFinite(numericAmount)) {
                throw new Error(`Invalid amount format: ${amount}`);
            }
            const baseUnitAmount = parseUnits(amount, decimals);
            return String(baseUnitAmount);
        } catch (error) {
            console.error(`Failed to convert amount ${amount} to base units with ${decimals} decimals: ${error}`);
            throw new Error(
                `Failed to convert amount to base units: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    async convertFromBaseUnits(params: {
        amount: string;
        tokenAddress?: `0x${string}`;
    }): Promise<string> {
        const { amount, tokenAddress } = params;

        // Validate base amount is a valid integer string
        if (!/^\d+$/.test(amount)) {
            throw new Error(`Invalid base unit amount format: ${amount}`);
        }

        const decimals = await this._getTokenDecimals(tokenAddress);

        try {
            const decimalAmount = formatUnits(BigInt(amount), decimals);
            return decimalAmount;
        } catch (error) {
            console.error(
                `Failed to convert base amount ${amount} from base units with ${decimals} decimals: ${error}`,
            );
            throw new Error(
                `Failed to convert amount from base units: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    async sendToken(params: {
        recipient: `0x${string}`;
        amountInBaseUnits: string;
        tokenAddress?: `0x${string}`;
    }): Promise<{ hash: string }> {
        if (!this.enableSend) {
            throw new Error("Sending tokens is disabled for this wallet instance.");
        }

        const { recipient, amountInBaseUnits, tokenAddress } = params;

        try {
            if (tokenAddress) {
                // ERC20 Transfer
                return this.sendTransaction({
                    to: tokenAddress,
                    abi: ERC20_ABI,
                    functionName: "transfer",
                    args: [recipient, BigInt(amountInBaseUnits)],
                });
            }

            // Native Transfer
            return this.sendTransaction({
                to: recipient,
                value: BigInt(amountInBaseUnits),
                // No data, ABI, or functionName needed for native transfer
            });
        } catch (error) {
            console.error(`Failed to send token: ${error}`);
            throw new Error(`Failed to send token: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    // --- Implementation of EVM-specific methods (formerly in Erc20Service) ---

    async getTokenAllowance(params: GetTokenAllowanceParameters): Promise<string> {
        try {
            const { tokenAddress, owner, spender } = params;
            const rawAllowance = await this.read({
                address: tokenAddress,
                abi: ERC20_ABI,
                functionName: "allowance",
                args: [owner, spender],
            });
            if (rawAllowance.value === undefined) {
                throw new Error("Could not retrieve allowance.");
            }
            // Return allowance in base units
            return String(rawAllowance.value);
        } catch (error) {
            console.error(`Failed to fetch allowance: ${error}`);
            throw Error(`Failed to fetch allowance: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async approve(params: ApproveParameters): Promise<{ hash: string }> {
        if (!this.enableSend) {
            throw new Error("Approval operations are disabled for this wallet instance.");
        }
        try {
            const { tokenAddress, spender, amount } = params;
            // Validate base amount is a valid integer string
            if (!/^\d+$/.test(amount)) {
                throw new Error(`Invalid base unit amount format for approval: ${amount}`);
            }
            return this.sendTransaction({
                to: tokenAddress,
                abi: ERC20_ABI,
                functionName: "approve",
                args: [spender, BigInt(amount)], // Amount parameter is already in base units
            });
        } catch (error) {
            console.error(`Failed to approve: ${error}`);
            throw Error(`Failed to approve: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async revokeApproval(params: {
        tokenAddress: `0x${string}`;
        spender: `0x${string}`;
    }): Promise<{ hash: string }> {
        if (!this.enableSend) {
            throw new Error("Approval operations are disabled for this wallet instance.");
        }
        // Revoke is just approving zero amount
        return this.approve({ ...params, amount: "0" });
    }

    // Override getCoreTools to add EVM specific tools
    override getCoreTools(): ToolBase[] {
        const baseTools = super.getCoreTools().filter((tool) => tool.name !== "get_balance"); // Remove generic base balance tool

        const commonEvmTools: ToolBase[] = [
            // Override get_balance with EVM specifics
            createTool(
                {
                    name: "get_balance",
                    description: "Get the balance of the wallet for native currency or a specific ERC20 token.",
                    parameters: getBalanceParametersSchema,
                },
                (params) => this.balanceOf(params.address, params.tokenAddress),
            ),
            // Add get_token_info_by_ticker tool
            createTool(
                {
                    name: "get_token_info_by_ticker",
                    description:
                        "Get information about a configured token (like contract address and decimals) by its ticker symbol.",
                    parameters: getTokenInfoByTickerParametersSchema,
                },
                (params) => this.getTokenInfoByTicker(params.ticker),
            ),
            // Add convert_to_base_units tool
            createTool(
                {
                    name: "convert_to_base_units",
                    description: "Convert a token amount from human-readable units to its smallest unit (e.g., wei).",
                    parameters: convertToBaseUnitsParametersSchema,
                },
                (params) => this.convertToBaseUnits(params),
            ),
            // Add convert_from_base_units tool
            createTool(
                {
                    name: "convert_from_base_units",
                    description: "Convert a token amount from its smallest unit (e.g., wei) to human-readable units.",
                    parameters: convertFromBaseUnitsParametersSchema,
                },
                (params) => this.convertFromBaseUnits(params),
            ),
            // Tool for signTypedData
            createTool(
                {
                    name: "sign_typed_data_evm",
                    description: "Sign an EIP-712 typed data structure (EVM)",
                    parameters: signTypedDataParametersSchema,
                },
                (data: EVMTypedData) => this.signTypedData(data),
            ),
            // Tool for getTokenAllowance
            createTool(
                {
                    name: "get_token_allowance_evm",
                    description: "Get the allowance of an ERC20 token for a spender (returns amount in base units)",
                    parameters: getTokenAllowanceParametersSchema,
                },
                (params) => this.getTokenAllowance(params),
            ),
        ];

        const sendingEvmTools: ToolBase[] = [];

        if (this.enableSend) {
            sendingEvmTools.push(
                // Add send_token tool
                createTool(
                    {
                        name: "send_token",
                        description: "Send native currency or an ERC20 token to a recipient, in base units.",
                        parameters: sendTokenParametersSchema,
                    },
                    (params) => {
                        // Double check, though the tool shouldn't be registered if false
                        if (!this.enableSend) {
                            throw new Error("Sending transactions is disabled for this wallet.");
                        }
                        return this.sendToken(params);
                    },
                ),
                // Tool for approve
                createTool(
                    {
                        name: "approve_token_evm",
                        description: "Approve an amount (specified in base units) of an ERC20 token for a spender",
                        parameters: approveParametersSchema,
                    },
                    (params) => {
                        // Double check
                        if (!this.enableSend) {
                            throw new Error("Approval operations are disabled for this wallet instance.");
                        }
                        return this.approve(params);
                    },
                ),
                // Tool for revokeApproval
                createTool(
                    {
                        name: "revoke_token_approval_evm",
                        description: "Revoke approval for an ERC20 token from a spender (sets allowance to 0)",
                        parameters: revokeApprovalParametersSchema,
                    },
                    (params) => {
                        // Double check
                        if (!this.enableSend) {
                            throw new Error("Approval operations are disabled for this wallet instance.");
                        }
                        return this.revokeApproval(params);
                    },
                ),
            );
        }

        return [...baseTools, ...commonEvmTools, ...sendingEvmTools];
    }
}
