export const ROUTER_ABI = [
    {
        inputs: [
            {
                internalType: "address",
                name: "_factory",
                type: "address",
            },
            {
                internalType: "address",
                name: "_weth",
                type: "address",
            },
            {
                internalType: "address",
                name: "_sfs",
                type: "address",
            },
            {
                internalType: "address",
                name: "_recipient",
                type: "address",
            },
        ],
        stateMutability: "nonpayable",
        type: "constructor",
    },
    {
        inputs: [],
        name: "ETHTransferFailed",
        type: "error",
    },
    {
        inputs: [],
        name: "Expired",
        type: "error",
    },
    {
        inputs: [],
        name: "InsufficientAmount",
        type: "error",
    },
    {
        inputs: [],
        name: "InsufficientAmountA",
        type: "error",
    },
    {
        inputs: [],
        name: "InsufficientAmountADesired",
        type: "error",
    },
    {
        inputs: [],
        name: "InsufficientAmountB",
        type: "error",
    },
    {
        inputs: [],
        name: "InsufficientAmountBDesired",
        type: "error",
    },
    {
        inputs: [],
        name: "InsufficientLiquidity",
        type: "error",
    },
    {
        inputs: [],
        name: "InsufficientOutputAmount",
        type: "error",
    },
    {
        inputs: [],
        name: "InvalidPath",
        type: "error",
    },
    {
        inputs: [],
        name: "OnlyWETH",
        type: "error",
    },
    {
        inputs: [],
        name: "SameAddresses",
        type: "error",
    },
    {
        inputs: [],
        name: "ZeroAddress",
        type: "error",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "tokenA",
                type: "address",
            },
            {
                internalType: "address",
                name: "tokenB",
                type: "address",
            },
            {
                internalType: "bool",
                name: "stable",
                type: "bool",
            },
            {
                internalType: "uint256",
                name: "amountADesired",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "amountBDesired",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "amountAMin",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "amountBMin",
                type: "uint256",
            },
            {
                internalType: "address",
                name: "to",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "deadline",
                type: "uint256",
            },
        ],
        name: "addLiquidity",
        outputs: [
            {
                internalType: "uint256",
                name: "amountA",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "amountB",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "liquidity",
                type: "uint256",
            },
        ],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "token",
                type: "address",
            },
            {
                internalType: "bool",
                name: "stable",
                type: "bool",
            },
            {
                internalType: "uint256",
                name: "amountTokenDesired",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "amountTokenMin",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "amountETHMin",
                type: "uint256",
            },
            {
                internalType: "address",
                name: "to",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "deadline",
                type: "uint256",
            },
        ],
        name: "addLiquidityETH",
        outputs: [
            {
                internalType: "uint256",
                name: "amountToken",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "amountETH",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "liquidity",
                type: "uint256",
            },
        ],
        stateMutability: "payable",
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
        inputs: [
            {
                internalType: "uint256",
                name: "amountIn",
                type: "uint256",
            },
            {
                components: [
                    {
                        internalType: "address",
                        name: "from",
                        type: "address",
                    },
                    {
                        internalType: "address",
                        name: "to",
                        type: "address",
                    },
                    {
                        internalType: "bool",
                        name: "stable",
                        type: "bool",
                    },
                ],
                internalType: "struct IRouter.Route[]",
                name: "routes",
                type: "tuple[]",
            },
        ],
        name: "getAmountsOut",
        outputs: [
            {
                internalType: "uint256[]",
                name: "amounts",
                type: "uint256[]",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "tokenA",
                type: "address",
            },
            {
                internalType: "address",
                name: "tokenB",
                type: "address",
            },
            {
                internalType: "bool",
                name: "stable",
                type: "bool",
            },
        ],
        name: "getReserves",
        outputs: [
            {
                internalType: "uint256",
                name: "reserveA",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "reserveB",
                type: "uint256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "tokenA",
                type: "address",
            },
            {
                internalType: "address",
                name: "tokenB",
                type: "address",
            },
            {
                internalType: "bool",
                name: "stable",
                type: "bool",
            },
        ],
        name: "poolFor",
        outputs: [
            {
                internalType: "address",
                name: "pool",
                type: "address",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "poolImplementation",
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
                internalType: "address",
                name: "tokenA",
                type: "address",
            },
            {
                internalType: "address",
                name: "tokenB",
                type: "address",
            },
            {
                internalType: "bool",
                name: "stable",
                type: "bool",
            },
            {
                internalType: "uint256",
                name: "amountADesired",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "amountBDesired",
                type: "uint256",
            },
        ],
        name: "quoteAddLiquidity",
        outputs: [
            {
                internalType: "uint256",
                name: "amountA",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "amountB",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "liquidity",
                type: "uint256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "tokenA",
                type: "address",
            },
            {
                internalType: "address",
                name: "tokenB",
                type: "address",
            },
            {
                internalType: "bool",
                name: "stable",
                type: "bool",
            },
            {
                internalType: "uint256",
                name: "liquidity",
                type: "uint256",
            },
        ],
        name: "quoteRemoveLiquidity",
        outputs: [
            {
                internalType: "uint256",
                name: "amountA",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "amountB",
                type: "uint256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "tokenA",
                type: "address",
            },
            {
                internalType: "address",
                name: "tokenB",
                type: "address",
            },
            {
                internalType: "bool",
                name: "stable",
                type: "bool",
            },
            {
                internalType: "uint256",
                name: "liquidity",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "amountAMin",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "amountBMin",
                type: "uint256",
            },
            {
                internalType: "address",
                name: "to",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "deadline",
                type: "uint256",
            },
        ],
        name: "removeLiquidity",
        outputs: [
            {
                internalType: "uint256",
                name: "amountA",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "amountB",
                type: "uint256",
            },
        ],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "token",
                type: "address",
            },
            {
                internalType: "bool",
                name: "stable",
                type: "bool",
            },
            {
                internalType: "uint256",
                name: "liquidity",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "amountTokenMin",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "amountETHMin",
                type: "uint256",
            },
            {
                internalType: "address",
                name: "to",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "deadline",
                type: "uint256",
            },
        ],
        name: "removeLiquidityETH",
        outputs: [
            {
                internalType: "uint256",
                name: "amountToken",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "amountETH",
                type: "uint256",
            },
        ],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "token",
                type: "address",
            },
            {
                internalType: "bool",
                name: "stable",
                type: "bool",
            },
            {
                internalType: "uint256",
                name: "liquidity",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "amountTokenMin",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "amountETHMin",
                type: "uint256",
            },
            {
                internalType: "address",
                name: "to",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "deadline",
                type: "uint256",
            },
        ],
        name: "removeLiquidityETHSupportingFeeOnTransferTokens",
        outputs: [
            {
                internalType: "uint256",
                name: "amountETH",
                type: "uint256",
            },
        ],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "tokenA",
                type: "address",
            },
            {
                internalType: "address",
                name: "tokenB",
                type: "address",
            },
        ],
        name: "sortTokens",
        outputs: [
            {
                internalType: "address",
                name: "token0",
                type: "address",
            },
            {
                internalType: "address",
                name: "token1",
                type: "address",
            },
        ],
        stateMutability: "pure",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "amountOutMin",
                type: "uint256",
            },
            {
                components: [
                    {
                        internalType: "address",
                        name: "from",
                        type: "address",
                    },
                    {
                        internalType: "address",
                        name: "to",
                        type: "address",
                    },
                    {
                        internalType: "bool",
                        name: "stable",
                        type: "bool",
                    },
                ],
                internalType: "struct IRouter.Route[]",
                name: "routes",
                type: "tuple[]",
            },
            {
                internalType: "address",
                name: "to",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "deadline",
                type: "uint256",
            },
        ],
        name: "swapExactETHForTokens",
        outputs: [
            {
                internalType: "uint256[]",
                name: "amounts",
                type: "uint256[]",
            },
        ],
        stateMutability: "payable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "amountIn",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "amountOutMin",
                type: "uint256",
            },
            {
                components: [
                    {
                        internalType: "address",
                        name: "from",
                        type: "address",
                    },
                    {
                        internalType: "address",
                        name: "to",
                        type: "address",
                    },
                    {
                        internalType: "bool",
                        name: "stable",
                        type: "bool",
                    },
                ],
                internalType: "struct IRouter.Route[]",
                name: "routes",
                type: "tuple[]",
            },
            {
                internalType: "address",
                name: "to",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "deadline",
                type: "uint256",
            },
        ],
        name: "swapExactTokensForETH",
        outputs: [
            {
                internalType: "uint256[]",
                name: "amounts",
                type: "uint256[]",
            },
        ],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "amountIn",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "amountOutMin",
                type: "uint256",
            },
            {
                components: [
                    {
                        internalType: "address",
                        name: "from",
                        type: "address",
                    },
                    {
                        internalType: "address",
                        name: "to",
                        type: "address",
                    },
                    {
                        internalType: "bool",
                        name: "stable",
                        type: "bool",
                    },
                ],
                internalType: "struct IRouter.Route[]",
                name: "routes",
                type: "tuple[]",
            },
            {
                internalType: "address",
                name: "to",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "deadline",
                type: "uint256",
            },
        ],
        name: "swapExactTokensForTokens",
        outputs: [
            {
                internalType: "uint256[]",
                name: "amounts",
                type: "uint256[]",
            },
        ],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [],
        name: "tokenId",
        outputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "weth",
        outputs: [
            {
                internalType: "contract IWETH",
                name: "",
                type: "address",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        stateMutability: "payable",
        type: "receive",
    },
] as const;
