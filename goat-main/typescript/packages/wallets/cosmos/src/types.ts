import { DeliverTxResponse, ExecuteResult, JsonObject } from "@cosmjs/cosmwasm-stargate";
import { EncodeObject } from "@cosmjs/proto-signing";
import { QueryAbciResponse } from "@cosmjs/stargate";
import { CosmosChain, WalletClientBase } from "@goat-sdk/core";

export type CosmosTransaction = {
    message: EncodeObject;
};

export type CosmosReadRequest = {
    message: EncodeObject;
};

export type ContractWriteData = {
    contractAdr: string;
    message: JsonObject;
};

export type ContractReadData = {
    contractAdr: string;
    message: JsonObject;
};

export type CosmosTransactionResult = {
    value: DeliverTxResponse;
};

export type CosmosReadResult = {
    value: QueryAbciResponse;
};

export type ContractWriteResult = {
    value: ExecuteResult;
};

export type ContractReadResult = {
    value: JsonObject;
};

export abstract class CosmosWalletClient extends WalletClientBase {
    abstract getChain(): CosmosChain;
    abstract getChainId(): Promise<string>;
    abstract sendTransaction(transaction: CosmosTransaction): Promise<CosmosTransactionResult>;
    abstract contractWrite(transaction: ContractWriteData): Promise<ContractWriteResult>;
    abstract read(request: CosmosReadRequest): Promise<CosmosReadResult>;
    abstract contractRead(request: ContractReadData): Promise<ContractReadResult>;
}
