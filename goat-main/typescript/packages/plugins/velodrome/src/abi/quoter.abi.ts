export const QUOTER_ABI = [
    {
        inputs: [
            {
                internalType: "address",
                name: "_factory",
                type: "address",
            },
            {
                internalType: "address",
                name: "_factoryV2",
                type: "address",
            },
            {
                internalType: "address",
                name: "_WETH9",
                type: "address",
            },
        ],
        stateMutability: "nonpayable",
        type: "constructor",
    },
    {
        inputs: [],
        name: "WETH9",
        outputs: [
            {
                internalType: "address",
                name: "",
                type: "address",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "factory",
        outputs: [
            {
                internalType: "address",
                name: "",
                type: "address",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "factoryV2",
        outputs: [
            {
                internalType: "address",
                name: "",
                type: "address",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "bytes",
                name: "path",
                type: "bytes",
            },
            {
                internalType: "uint256",
                name: "amountIn",
                type: "uint256",
            },
        ],
        name: "quoteExactInput",
        outputs: [
            {
                internalType: "uint256",
                name: "amountOut",
                type: "uint256",
            },
            {
                internalType: "uint160[]",
                name: "v3SqrtPriceX96AfterList",
                type: "uint160[]",
            },
            {
                internalType: "uint32[]",
                name: "v3InitializedTicksCrossedList",
                type: "uint32[]",
            },
            {
                internalType: "uint256",
                name: "v3SwapGasEstimate",
                type: "uint256",
            },
        ],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                components: [
                    {
                        internalType: "address",
                        name: "tokenIn",
                        type: "address",
                    },
                    {
                        internalType: "address",
                        name: "tokenOut",
                        type: "address",
                    },
                    {
                        internalType: "bool",
                        name: "stable",
                        type: "bool",
                    },
                    {
                        internalType: "uint256",
                        name: "amountIn",
                        type: "uint256",
                    },
                ],
                internalType: "struct IMixedRouteQuoterV1.QuoteExactInputSingleV2Params",
                name: "params",
                type: "tuple",
            },
        ],
        name: "quoteExactInputSingleV2",
        outputs: [
            {
                internalType: "uint256",
                name: "amountOut",
                type: "uint256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                components: [
                    {
                        internalType: "address",
                        name: "tokenIn",
                        type: "address",
                    },
                    {
                        internalType: "address",
                        name: "tokenOut",
                        type: "address",
                    },
                    {
                        internalType: "uint256",
                        name: "amountIn",
                        type: "uint256",
                    },
                    {
                        internalType: "int24",
                        name: "tickSpacing",
                        type: "int24",
                    },
                    {
                        internalType: "uint160",
                        name: "sqrtPriceLimitX96",
                        type: "uint160",
                    },
                ],
                internalType: "struct IMixedRouteQuoterV1.QuoteExactInputSingleV3Params",
                name: "params",
                type: "tuple",
            },
        ],
        name: "quoteExactInputSingleV3",
        outputs: [
            {
                internalType: "uint256",
                name: "amountOut",
                type: "uint256",
            },
            {
                internalType: "uint160",
                name: "sqrtPriceX96After",
                type: "uint160",
            },
            {
                internalType: "uint32",
                name: "initializedTicksCrossed",
                type: "uint32",
            },
            {
                internalType: "uint256",
                name: "gasEstimate",
                type: "uint256",
            },
        ],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "int256",
                name: "amount0Delta",
                type: "int256",
            },
            {
                internalType: "int256",
                name: "amount1Delta",
                type: "int256",
            },
            {
                internalType: "bytes",
                name: "path",
                type: "bytes",
            },
        ],
        name: "uniswapV3SwapCallback",
        outputs: [],
        stateMutability: "view",
        type: "function",
    },
] as const;
