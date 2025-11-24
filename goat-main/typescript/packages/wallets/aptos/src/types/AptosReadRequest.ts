import type { InputViewFunctionData, LedgerVersionArg } from "@aptos-labs/ts-sdk";

export type AptosReadRequest = {
    viewFunctionData: InputViewFunctionData;
    ledgerVersionArg?: LedgerVersionArg;
};
