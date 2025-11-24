import { Tool } from "@goat-sdk/core";
import { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { API, OrderEntity, OrderSide, OrderType } from "@orderly.network/types";
import { solidityPackedKeccak256 } from "ethers";
import { Address, erc20Abi } from "viem";
import { ORDERLY_VAULT_ABI, getEvmUSDCAddress, getEvmVaultAddress } from "./abi/vaults.abi";
import {
    createOrderAtOrderly,
    getAccountId,
    getBaseUrlFromNetwork,
    getBrokerId,
    getHoldings,
    getNetwork,
    getOrderlyKey,
    getPosition,
    getPositions,
    settlePnlFromOrderly,
    withdrawUSDCFromOrderly,
} from "./helper/helper";
import {
    ClosePositionOrderlyParams,
    CreateOrderOrderlyParams,
    DepositOrderlyParams,
    GetAllowedSymbolByNetworkParams,
    GetUSDCBalanceHoldingsOrderlyParams,
    GetUSDCInfoOrderlyParams,
    WithdrawOrderlyParams,
} from "./parameters";

export class OrderlyNetworkService {
    @Tool({
        name: "deposit_orderly_evm",
        description: "Deposit USDC into Orderly Network",
    })
    async depositOrderly(
        walletClient: EVMWalletClient,
        parameters: DepositOrderlyParams,
    ): Promise<DepositOrderlyResponse> {
        const userAddress = walletClient.getAddress();
        const chain = walletClient.getChain();
        if (!chain.id) {
            throw new Error("Chain not configured in wallet client");
        }

        const usdcAmount = BigInt(parameters.amount);
        const brokerId = getBrokerId();

        const EVM_USDC_ADDRESS = getEvmUSDCAddress(chain.id);
        const EVM_VAULT_ADDRESS = getEvmVaultAddress(chain.id);

        const depositInput = {
            brokerHash: solidityPackedKeccak256(["string"], [brokerId]) as Address,
            tokenAmount: usdcAmount,
            tokenHash: solidityPackedKeccak256(["string"], ["USDC"]) as Address,
            accountId: getAccountId(userAddress) as Address,
        };

        try {
            const allowanceRaw = await walletClient.read({
                address: EVM_USDC_ADDRESS,
                abi: erc20Abi,
                functionName: "allowance",
                args: [userAddress, EVM_VAULT_ADDRESS],
            });
            const allowance = BigInt(allowanceRaw.value as string);

            if (allowance < usdcAmount) {
                await walletClient.sendTransaction({
                    to: EVM_USDC_ADDRESS,
                    abi: erc20Abi,
                    functionName: "approve",
                    args: [EVM_VAULT_ADDRESS, usdcAmount],
                });
            }

            const depositFeeRaw = await walletClient.read({
                address: EVM_VAULT_ADDRESS,
                abi: ORDERLY_VAULT_ABI,
                functionName: "getDepositFee",
                args: [userAddress, depositInput],
            });

            const depositFee = BigInt(depositFeeRaw.value as string);
            const tx = await walletClient.sendTransaction({
                to: EVM_VAULT_ADDRESS,
                abi: ORDERLY_VAULT_ABI,
                functionName: "deposit",
                args: [depositInput],
                value: depositFee,
            });

            return { hash: tx.hash, chain: chain.id };
        } catch (error) {
            throw new Error(`Deposit failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }

    @Tool({
        name: "withdraw_orderly_evm",
        description: "Withdraw USDC from Orderly Network",
    })
    async withdrawOrderly(
        walletClient: EVMWalletClient,
        parameters: WithdrawOrderlyParams,
    ): Promise<WithdrawOrderlyResponse> {
        const userAddress = walletClient.getAddress();
        const chain = walletClient.getChain();
        if (!chain.id) {
            throw new Error("Chain not configured in wallet client");
        }

        const usdcAmount = BigInt(parameters.amount);
        const brokerId = getBrokerId();
        const accountId = getAccountId(userAddress);
        const orderlyKey = await getOrderlyKey();
        const network = getNetwork();

        try {
            const positions = await getPositions(network, accountId, orderlyKey);

            const unsettledPnl = positions.rows.reduce((acc, position) => {
                return acc + position.unsettled_pnl;
            }, 0);

            if (unsettledPnl !== 0) {
                await settlePnlFromOrderly(chain.id, brokerId, accountId, orderlyKey, walletClient);
            }

            const { code, message, success } = await withdrawUSDCFromOrderly(
                chain.id,
                brokerId,
                accountId,
                orderlyKey,
                usdcAmount,
                walletClient,
            );
            return { amount: usdcAmount.toString(), chain: chain.id, code, message, success };
        } catch (error) {
            return {
                amount: usdcAmount.toString(),
                chain: chain.id,
                code: 0,
                message: error instanceof Error ? error.message : "Unknown error",
                success: false,
            };
        }
    }

    @Tool({
        name: "create_order_orderly",
        description: "Create an order at Orderly Network",
    })
    async createOrderOrderly(
        walletClient: EVMWalletClient,
        parameters: CreateOrderOrderlyParams,
    ): Promise<CreateOrderOrderlyResponse> {
        const chain = walletClient.getChain();
        if (!chain.id) {
            throw new Error("Chain not configured in wallet client");
        }

        const network = getNetwork();
        const accountId = getAccountId(walletClient.getAddress());
        const orderlyKey = await getOrderlyKey();

        const convertedOrderType: OrderType = parameters.order_type === "MARKET" ? OrderType.MARKET : OrderType.LIMIT;

        if (convertedOrderType === OrderType.MARKET) {
            parameters.order_price = undefined;
            if (parameters.side === "BUY") {
                parameters.order_amount = undefined;
            }
        }

        const order = {
            ...parameters,
            order_type: convertedOrderType,
        };

        try {
            const orderId = await createOrderAtOrderly(network, accountId, orderlyKey, order as OrderEntity);
            return { order_id: orderId, success: true, message: "Order created successfully" };
        } catch (error) {
            return {
                order_id: "",
                success: false,
                message: error instanceof Error ? error.message : "Unknown error",
            };
        }
    }

    @Tool({
        name: "close_position_orderly",
        description: "Close a position at Orderly Network",
    })
    async closePositionOrderly(
        walletClient: EVMWalletClient,
        parameters: ClosePositionOrderlyParams,
    ): Promise<{ order_id: string; success: boolean; message: string }> {
        try {
            getBrokerId();
            const network = getNetwork();
            const accountId = getAccountId(walletClient.getAddress());
            const orderlyKey = await getOrderlyKey();

            const position = await getPosition(network, accountId, orderlyKey, parameters.symbol);
            if (!position) {
                throw new Error(`No position found for symbol ${parameters.symbol}`);
            }
            if (position.position_qty === 0) {
                throw new Error("Position quantity is zero, there is no position to close");
            }

            const order: OrderEntity = {
                order_type: OrderType.MARKET,
                side: position.position_qty > 0 ? OrderSide.SELL : OrderSide.BUY,
                symbol: position.symbol,
                reduce_only: true,
                order_quantity: String(Math.abs(position.position_qty)),
            };

            const orderId = await createOrderAtOrderly(network, accountId, orderlyKey, order);
            return {
                order_id: orderId,
                success: true,
                message: "Order created successfully",
            };
        } catch (error) {
            return {
                order_id: "",
                success: false,
                message: error instanceof Error ? error.message : "Unknown error",
            };
        }
    }

    @Tool({
        name: "get_allowed_symbol_by_network",
        description: "Get allowed symbol by network and token",
    })
    async getAllowedSymbolByNetwork(
        walletClient: EVMWalletClient,
        parameters: GetAllowedSymbolByNetworkParams,
    ): Promise<string> {
        const chain = walletClient.getChain();
        if (!chain.id) {
            throw new Error("Chain not configured in wallet client");
        }

        const network = getNetwork();
        const response = await fetch(`${getBaseUrlFromNetwork(network)}/v1/public/info`);
        const symbols = (await response.json()) as {
            data: {
                rows: { symbol: string }[];
            };
        };

        const allowedSymbol =
            symbols.data.rows.find(({ symbol }) => symbol.includes(`_${parameters.token.toUpperCase()}_`))?.symbol ??
            symbols.data.rows[0].symbol;
        return allowedSymbol;
    }

    @Tool({
        name: "get_usdc_info_orderly",
        description: "Get the info of the USDC token.",
    })
    async getUSDCInfoOrderly(walletClient: EVMWalletClient, parameters: GetUSDCInfoOrderlyParams): Promise<Token> {
        const chain = walletClient.getChain();
        if (!chain.id) {
            throw new Error("Chain not configured in wallet client");
        }

        const tokens: Record<string, Token> = {
            USDC: {
                decimals: 6,
                symbol: "USDC",
                name: "USDC",
                chains: {
                    34443: {
                        contractAddress: "0xd988097fb8612cc24eeC14542bC03424c656005f",
                    },
                    1: {
                        contractAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
                    },
                    42161: {
                        contractAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
                    },
                    10: {
                        contractAddress: "0x0b2c639c533813f4aa9d7837caf62653d097ff85",
                    },
                    8453: {
                        contractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                    },
                    5000: {
                        contractAddress: "0x09bc4e0d864854c6afb6eb9a9cdf58ac190d0df9",
                    },
                    1329: {
                        contractAddress: "0x3894085Ef7Ff0f0aeDf52E2A2704928d1Ec074F1",
                    },
                    43114: {
                        contractAddress: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
                    },
                    11155111: {
                        contractAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
                    },
                    421614: {
                        contractAddress: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
                    },
                    11155420: {
                        contractAddress: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
                    },
                    84532: {
                        contractAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                    },
                    5003: {
                        contractAddress: "0xAcab8129E2cE587fD203FD770ec9ECAFA2C88080",
                    },
                    713715: {
                        contractAddress: "0xd5164A5a83c64E59F842bC091E06614b84D95fF5",
                    },
                    43113: {
                        contractAddress: "0x5425890298aed601595a70ab815c96711a31bc65",
                    },
                },
            },
        };

        const token = tokens[parameters.symbol.toUpperCase()];
        if (!token) {
            throw new Error(`Token ${parameters.symbol} not found`);
        }
        const chainToken = token.chains[chain.id];
        if (!chainToken) {
            throw new Error(`Token ${parameters.symbol} not found in chain ${chain.id}`);
        }

        return {
            decimals: token.decimals,
            symbol: token.symbol,
            name: token.name,
            chains: {
                [chain.id]: {
                    contractAddress: chainToken.contractAddress,
                },
            },
        };
    }

    @Tool({
        name: "get_balance_holdings_orderly",
        description: "Get balance of user token holdings in Orderly.",
    })
    async getBalanceHoldingsOrderly(
        walletClient: EVMWalletClient,
        parameters: GetUSDCBalanceHoldingsOrderlyParams,
    ): Promise<API.Holding[]> {
        const userAddress = walletClient.getAddress();
        const chain = walletClient.getChain();
        if (!chain.id) {
            throw new Error("Chain not configured in wallet client");
        }
        const network = getNetwork();
        const accountId = getAccountId(userAddress);
        const orderlyKey = await getOrderlyKey();

        const holdings = await getHoldings(network, accountId, orderlyKey);

        return holdings;
    }
}

interface WithdrawOrderlyResponse {
    amount: string;
    chain: number;
    code: number;
    message: string;
    success: boolean;
}

interface DepositOrderlyResponse {
    hash: string;
    chain: number;
}

interface CreateOrderOrderlyResponse {
    success: boolean;
    order_id: string;
    message: string;
}

interface Token {
    decimals: number;
    symbol: string;
    name: string;
    chains: Record<number, { contractAddress: `0x${string}` }>;
}
