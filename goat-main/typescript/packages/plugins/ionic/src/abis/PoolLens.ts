export const poolLensAbi = [
    {
        inputs: [
            { name: "user", type: "address" },
            { name: "comptroller", type: "address" },
        ],
        name: "getUserPoolData",
        outputs: [
            {
                components: [
                    { name: "totalBorrow", type: "uint256" },
                    { name: "totalCollateral", type: "uint256" },
                    { name: "healthFactor", type: "uint256" },
                ],
                name: "",
                type: "tuple",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
] as const;
