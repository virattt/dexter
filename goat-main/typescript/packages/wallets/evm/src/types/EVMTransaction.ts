import type { Abi } from "abitype";

export type EVMTransaction = {
    to: string;
    functionName?: string;
    args?: unknown[];
    value?: bigint;
    abi?: Abi;
    options?: EVMTransactionOptions;
    data?: `0x${string}`;
};

export type EVMTransactionOptions = {
    paymaster?: {
        address: `0x${string}`;
        input: `0x${string}`;
    };
};
