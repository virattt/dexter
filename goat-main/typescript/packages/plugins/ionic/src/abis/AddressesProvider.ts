export const addressesProviderAbi = [
    {
        inputs: [{ name: "id", type: "string" }],
        name: "getAddress",
        outputs: [{ name: "", type: "address" }],
        stateMutability: "view",
        type: "function",
    },
] as const;
