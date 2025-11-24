import "reflect-metadata";
import { Tool, WalletClientBase } from "@goat-sdk/core";
import {
    AccountBalanceParameters,
    AccountTransactionsParameters,
    BlockByNumberParameters,
    ContractABIParameters,
    ContractSourceCodeParameters,
    EventLogsParameters,
    GasPriceParameters,
    TokenBalanceParameters,
    TransactionReceiptParameters,
    TransactionStatusParameters,
} from "./parameters";
import { buildUrl, etherscanRequest } from "./request";

// Common response types
export interface AccountBalance {
    status: string;
    message: string;
    result: string;
}

export interface TransactionList {
    status: string;
    message: string;
    result: Array<{
        blockNumber: string;
        timeStamp: string;
        hash: string;
        from: string;
        to: string;
        value: string;
        gas: string;
        gasPrice: string;
    }>;
}

// Types for better type safety
export type EtherscanResponse<T> = Promise<T>;

export class EtherscanService {
    constructor(private readonly apiKey: string) {}

    @Tool({
        name: "get_account_balance",
        description: "Get account balance from Etherscan",
    })
    async getAccountBalance(
        _walletClient: WalletClientBase,
        parameters: AccountBalanceParameters,
    ): EtherscanResponse<AccountBalance> {
        const { address, tag, network } = parameters;
        return etherscanRequest(
            buildUrl(network, "account", "balance", {
                address,
                tag,
            }),
            this.apiKey,
        );
    }

    @Tool({
        name: "get_account_transactions",
        description: "Get account transactions from Etherscan",
    })
    async getAccountTransactions(
        _walletClient: WalletClientBase,
        parameters: AccountTransactionsParameters,
    ): EtherscanResponse<TransactionList> {
        const { address, startBlock, endBlock, page, offset, sort, network } = parameters;
        return etherscanRequest(
            buildUrl(network, "account", "txlist", {
                address,
                startblock: startBlock ?? "",
                endblock: endBlock ?? "",
                page: page ?? "",
                offset: offset ?? "",
                sort: sort ?? "",
            }),
            this.apiKey,
        );
    }

    @Tool({
        name: "get_contract_abi",
        description: "Get contract ABI from Etherscan",
    })
    async getContractABI(
        _walletClient: WalletClientBase,
        parameters: ContractABIParameters,
    ): EtherscanResponse<string> {
        const { address, network } = parameters;
        return etherscanRequest(
            buildUrl(network, "contract", "getabi", {
                address,
            }),
            this.apiKey,
        );
    }

    @Tool({
        name: "get_contract_source_code",
        description: "Get contract source code from Etherscan",
    })
    async getContractSourceCode(
        _walletClient: WalletClientBase,
        parameters: ContractSourceCodeParameters,
    ): EtherscanResponse<string> {
        const { address, network } = parameters;
        return etherscanRequest(
            buildUrl(network, "contract", "getsourcecode", {
                address,
            }),
            this.apiKey,
        );
    }

    @Tool({
        name: "get_transaction_status",
        description: "Get transaction status from Etherscan",
    })
    async getTransactionStatus(
        _walletClient: WalletClientBase,
        parameters: TransactionStatusParameters,
    ): EtherscanResponse<{ status: string; message: string; result: { status: string } }> {
        const { txhash, network } = parameters;
        return etherscanRequest(
            buildUrl(network, "transaction", "getstatus", {
                txhash,
            }),
            this.apiKey,
        );
    }

    @Tool({
        name: "get_transaction_receipt",
        description: "Get transaction receipt from Etherscan",
    })
    async getTransactionReceipt(
        _walletClient: WalletClientBase,
        parameters: TransactionReceiptParameters,
    ): EtherscanResponse<{ status: string; message: string; result: { status: string } }> {
        const { txhash, network } = parameters;
        return etherscanRequest(
            buildUrl(network, "transaction", "gettxreceiptstatus", {
                txhash,
            }),
            this.apiKey,
        );
    }

    @Tool({
        name: "get_block_by_number",
        description: "Get block by number from Etherscan",
    })
    async getBlockByNumber(
        _walletClient: WalletClientBase,
        parameters: BlockByNumberParameters,
    ): EtherscanResponse<{
        jsonrpc: string;
        id: number;
        result: {
            number: string;
            hash: string;
            parentHash: string;
            transactions: string[];
            timestamp: string;
            nonce: string;
            difficulty: string;
            gasLimit: string;
            gasUsed: string;
            miner: string;
            extraData: string;
            size: string;
        };
    }> {
        const { blockNumber, network } = parameters;
        return etherscanRequest(
            buildUrl(network, "proxy", "eth_getBlockByNumber", {
                tag: typeof blockNumber === "number" ? `0x${blockNumber.toString(16)}` : blockNumber,
                boolean: true,
            }),
            this.apiKey,
        );
    }

    @Tool({
        name: "get_token_balance",
        description: "Get token balance from Etherscan",
    })
    async getTokenBalance(
        _walletClient: WalletClientBase,
        parameters: TokenBalanceParameters,
    ): EtherscanResponse<{ status: string; message: string; result: string }> {
        const { address, contractAddress, tag, network } = parameters;
        return etherscanRequest(
            buildUrl(network, "account", "tokenbalance", {
                address,
                contractaddress: contractAddress,
                tag,
            }),
            this.apiKey,
        );
    }

    @Tool({
        name: "get_gas_price",
        description: "Get current gas price from Etherscan",
    })
    async getGasPrice(
        _walletClient: WalletClientBase,
        parameters: GasPriceParameters,
    ): EtherscanResponse<{ jsonrpc: string; id: number; result: string }> {
        const { network } = parameters;
        return etherscanRequest(buildUrl(network, "proxy", "eth_gasPrice", {}), this.apiKey);
    }

    @Tool({
        name: "get_event_logs",
        description: "Get event logs from Etherscan",
    })
    async getEventLogs(
        _walletClient: WalletClientBase,
        parameters: EventLogsParameters,
    ): EtherscanResponse<{
        status: string;
        message: string;
        result: Array<{
            address: string;
            topics: string[];
            data: string;
            blockNumber: string;
            timeStamp: string;
            gasPrice: string;
            gasUsed: string;
            logIndex: string;
            transactionHash: string;
            transactionIndex: string;
            blockHash: string;
        }>;
    }> {
        const { address, fromBlock, toBlock, topic0, topic1, topic2, topic3, network } = parameters;
        const params: Record<string, string | number> = {
            address,
            fromBlock: typeof fromBlock === "number" ? `0x${fromBlock.toString(16)}` : (fromBlock ?? ""),
            toBlock: typeof toBlock === "number" ? `0x${toBlock.toString(16)}` : (toBlock ?? ""),
        };

        if (topic0) params.topic0 = topic0;
        if (topic1) params.topic1 = topic1;
        if (topic2) params.topic2 = topic2;
        if (topic3) params.topic3 = topic3;

        return etherscanRequest(buildUrl(network, "logs", "getLogs", params), this.apiKey);
    }
}
