import type { TypedDataDomain } from "abitype";

export type EVMTypedData = {
    domain: TypedDataDomain;
    types: Record<string, unknown>;
    primaryType: string;
    message: Record<string, unknown>;
};
