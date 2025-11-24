import type { Abi } from "abitype";

export type EVMReadRequest = {
    address: string;
    functionName: string;
    args?: unknown[];
    abi: Abi;
};
