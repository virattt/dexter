export const POOL_ABI = [
    {
        inputs: [],
        name: "alreadyInitialized",
        type: "error",
    },
    {
        inputs: [],
        name: "arithmeticError",
        type: "error",
    },
    {
        inputs: [],
        name: "bottomTickLowerThanMIN",
        type: "error",
    },
    {
        inputs: [],
        name: "dynamicFeeActive",
        type: "error",
    },
    {
        inputs: [],
        name: "dynamicFeeDisabled",
        type: "error",
    },
    {
        inputs: [],
        name: "flashInsufficientPaid0",
        type: "error",
    },
    {
        inputs: [],
        name: "flashInsufficientPaid1",
        type: "error",
    },
    {
        inputs: [],
        name: "insufficientInputAmount",
        type: "error",
    },
    {
        inputs: [],
        name: "invalidAmountRequired",
        type: "error",
    },
    {
        inputs: [
            {
                internalType: "bytes4",
                name: "expectedSelector",
                type: "bytes4",
            },
        ],
        name: "invalidHookResponse",
        type: "error",
    },
    {
        inputs: [],
        name: "invalidLimitSqrtPrice",
        type: "error",
    },
    {
        inputs: [],
        name: "invalidNewCommunityFee",
        type: "error",
    },
    {
        inputs: [],
        name: "invalidNewTickSpacing",
        type: "error",
    },
    {
        inputs: [],
        name: "liquidityAdd",
        type: "error",
    },
    {
        inputs: [],
        name: "liquidityOverflow",
        type: "error",
    },
    {
        inputs: [],
        name: "liquiditySub",
        type: "error",
    },
    {
        inputs: [],
        name: "locked",
        type: "error",
    },
    {
        inputs: [],
        name: "notAllowed",
        type: "error",
    },
    {
        inputs: [],
        name: "notInitialized",
        type: "error",
    },
    {
        inputs: [],
        name: "pluginIsNotConnected",
        type: "error",
    },
    {
        inputs: [],
        name: "priceOutOfRange",
        type: "error",
    },
    {
        inputs: [],
        name: "tickInvalidLinks",
        type: "error",
    },
    {
        inputs: [],
        name: "tickIsNotInitialized",
        type: "error",
    },
    {
        inputs: [],
        name: "tickIsNotSpaced",
        type: "error",
    },
    {
        inputs: [],
        name: "tickOutOfRange",
        type: "error",
    },
    {
        inputs: [],
        name: "topTickAboveMAX",
        type: "error",
    },
    {
        inputs: [],
        name: "topTickLowerOrEqBottomTick",
        type: "error",
    },
    {
        inputs: [],
        name: "transferFailed",
        type: "error",
    },
    {
        inputs: [],
        name: "zeroAmountRequired",
        type: "error",
    },
    {
        inputs: [],
        name: "zeroLiquidityActual",
        type: "error",
    },
    {
        inputs: [],
        name: "zeroLiquidityDesired",
        type: "error",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "address",
                name: "owner",
                type: "address",
            },
            {
                indexed: true,
                internalType: "int24",
                name: "bottomTick",
                type: "int24",
            },
            {
                indexed: true,
                internalType: "int24",
                name: "topTick",
                type: "int24",
            },
            {
                indexed: false,
                internalType: "uint128",
                name: "liquidityAmount",
                type: "uint128",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "amount0",
                type: "uint256",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "amount1",
                type: "uint256",
            },
        ],
        name: "Burn",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "address",
                name: "owner",
                type: "address",
            },
            {
                indexed: false,
                internalType: "address",
                name: "recipient",
                type: "address",
            },
            {
                indexed: true,
                internalType: "int24",
                name: "bottomTick",
                type: "int24",
            },
            {
                indexed: true,
                internalType: "int24",
                name: "topTick",
                type: "int24",
            },
            {
                indexed: false,
                internalType: "uint128",
                name: "amount0",
                type: "uint128",
            },
            {
                indexed: false,
                internalType: "uint128",
                name: "amount1",
                type: "uint128",
            },
        ],
        name: "Collect",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "uint16",
                name: "communityFeeNew",
                type: "uint16",
            },
        ],
        name: "CommunityFee",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "address",
                name: "newCommunityVault",
                type: "address",
            },
        ],
        name: "CommunityVault",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "uint16",
                name: "fee",
                type: "uint16",
            },
        ],
        name: "Fee",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "address",
                name: "sender",
                type: "address",
            },
            {
                indexed: true,
                internalType: "address",
                name: "recipient",
                type: "address",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "amount0",
                type: "uint256",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "amount1",
                type: "uint256",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "paid0",
                type: "uint256",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "paid1",
                type: "uint256",
            },
        ],
        name: "Flash",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "uint160",
                name: "price",
                type: "uint160",
            },
            {
                indexed: false,
                internalType: "int24",
                name: "tick",
                type: "int24",
            },
        ],
        name: "Initialize",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "address",
                name: "sender",
                type: "address",
            },
            {
                indexed: true,
                internalType: "address",
                name: "owner",
                type: "address",
            },
            {
                indexed: true,
                internalType: "int24",
                name: "bottomTick",
                type: "int24",
            },
            {
                indexed: true,
                internalType: "int24",
                name: "topTick",
                type: "int24",
            },
            {
                indexed: false,
                internalType: "uint128",
                name: "liquidityAmount",
                type: "uint128",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "amount0",
                type: "uint256",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "amount1",
                type: "uint256",
            },
        ],
        name: "Mint",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "address",
                name: "newPluginAddress",
                type: "address",
            },
        ],
        name: "Plugin",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "uint8",
                name: "newPluginConfig",
                type: "uint8",
            },
        ],
        name: "PluginConfig",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "address",
                name: "sender",
                type: "address",
            },
            {
                indexed: true,
                internalType: "address",
                name: "recipient",
                type: "address",
            },
            {
                indexed: false,
                internalType: "int256",
                name: "amount0",
                type: "int256",
            },
            {
                indexed: false,
                internalType: "int256",
                name: "amount1",
                type: "int256",
            },
            {
                indexed: false,
                internalType: "uint160",
                name: "price",
                type: "uint160",
            },
            {
                indexed: false,
                internalType: "uint128",
                name: "liquidity",
                type: "uint128",
            },
            {
                indexed: false,
                internalType: "int24",
                name: "tick",
                type: "int24",
            },
        ],
        name: "Swap",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "int24",
                name: "newTickSpacing",
                type: "int24",
            },
        ],
        name: "TickSpacing",
        type: "event",
    },
    {
        inputs: [
            {
                internalType: "int24",
                name: "bottomTick",
                type: "int24",
            },
            {
                internalType: "int24",
                name: "topTick",
                type: "int24",
            },
            {
                internalType: "uint128",
                name: "amount",
                type: "uint128",
            },
            {
                internalType: "bytes",
                name: "data",
                type: "bytes",
            },
        ],
        name: "burn",
        outputs: [
            {
                internalType: "uint256",
                name: "amount0",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "amount1",
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
                name: "recipient",
                type: "address",
            },
            {
                internalType: "int24",
                name: "bottomTick",
                type: "int24",
            },
            {
                internalType: "int24",
                name: "topTick",
                type: "int24",
            },
            {
                internalType: "uint128",
                name: "amount0Requested",
                type: "uint128",
            },
            {
                internalType: "uint128",
                name: "amount1Requested",
                type: "uint128",
            },
        ],
        name: "collect",
        outputs: [
            {
                internalType: "uint128",
                name: "amount0",
                type: "uint128",
            },
            {
                internalType: "uint128",
                name: "amount1",
                type: "uint128",
            },
        ],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [],
        name: "communityFeeLastTimestamp",
        outputs: [
            {
                internalType: "uint32",
                name: "",
                type: "uint32",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "communityVault",
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
        name: "fee",
        outputs: [
            {
                internalType: "uint16",
                name: "currentFee",
                type: "uint16",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "recipient",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "amount0",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "amount1",
                type: "uint256",
            },
            {
                internalType: "bytes",
                name: "data",
                type: "bytes",
            },
        ],
        name: "flash",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [],
        name: "getCommunityFeePending",
        outputs: [
            {
                internalType: "uint128",
                name: "",
                type: "uint128",
            },
            {
                internalType: "uint128",
                name: "",
                type: "uint128",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "getReserves",
        outputs: [
            {
                internalType: "uint128",
                name: "",
                type: "uint128",
            },
            {
                internalType: "uint128",
                name: "",
                type: "uint128",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "globalState",
        outputs: [
            {
                internalType: "uint160",
                name: "price",
                type: "uint160",
            },
            {
                internalType: "int24",
                name: "tick",
                type: "int24",
            },
            {
                internalType: "uint16",
                name: "lastFee",
                type: "uint16",
            },
            {
                internalType: "uint8",
                name: "pluginConfig",
                type: "uint8",
            },
            {
                internalType: "uint16",
                name: "communityFee",
                type: "uint16",
            },
            {
                internalType: "bool",
                name: "unlocked",
                type: "bool",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint160",
                name: "initialPrice",
                type: "uint160",
            },
        ],
        name: "initialize",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [],
        name: "isUnlocked",
        outputs: [
            {
                internalType: "bool",
                name: "unlocked",
                type: "bool",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "liquidity",
        outputs: [
            {
                internalType: "uint128",
                name: "",
                type: "uint128",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "maxLiquidityPerTick",
        outputs: [
            {
                internalType: "uint128",
                name: "",
                type: "uint128",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "leftoversRecipient",
                type: "address",
            },
            {
                internalType: "address",
                name: "recipient",
                type: "address",
            },
            {
                internalType: "int24",
                name: "bottomTick",
                type: "int24",
            },
            {
                internalType: "int24",
                name: "topTick",
                type: "int24",
            },
            {
                internalType: "uint128",
                name: "liquidityDesired",
                type: "uint128",
            },
            {
                internalType: "bytes",
                name: "data",
                type: "bytes",
            },
        ],
        name: "mint",
        outputs: [
            {
                internalType: "uint256",
                name: "amount0",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "amount1",
                type: "uint256",
            },
            {
                internalType: "uint128",
                name: "liquidityActual",
                type: "uint128",
            },
        ],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [],
        name: "nextTickGlobal",
        outputs: [
            {
                internalType: "int24",
                name: "",
                type: "int24",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "plugin",
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
                internalType: "bytes32",
                name: "",
                type: "bytes32",
            },
        ],
        name: "positions",
        outputs: [
            {
                internalType: "uint256",
                name: "liquidity",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "innerFeeGrowth0Token",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "innerFeeGrowth1Token",
                type: "uint256",
            },
            {
                internalType: "uint128",
                name: "fees0",
                type: "uint128",
            },
            {
                internalType: "uint128",
                name: "fees1",
                type: "uint128",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "prevTickGlobal",
        outputs: [
            {
                internalType: "int24",
                name: "",
                type: "int24",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "safelyGetStateOfAMM",
        outputs: [
            {
                internalType: "uint160",
                name: "sqrtPrice",
                type: "uint160",
            },
            {
                internalType: "int24",
                name: "tick",
                type: "int24",
            },
            {
                internalType: "uint16",
                name: "lastFee",
                type: "uint16",
            },
            {
                internalType: "uint8",
                name: "pluginConfig",
                type: "uint8",
            },
            {
                internalType: "uint128",
                name: "activeLiquidity",
                type: "uint128",
            },
            {
                internalType: "int24",
                name: "nextTick",
                type: "int24",
            },
            {
                internalType: "int24",
                name: "previousTick",
                type: "int24",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint16",
                name: "newCommunityFee",
                type: "uint16",
            },
        ],
        name: "setCommunityFee",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "newCommunityVault",
                type: "address",
            },
        ],
        name: "setCommunityVault",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint16",
                name: "newFee",
                type: "uint16",
            },
        ],
        name: "setFee",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "newPluginAddress",
                type: "address",
            },
        ],
        name: "setPlugin",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint8",
                name: "newConfig",
                type: "uint8",
            },
        ],
        name: "setPluginConfig",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "int24",
                name: "newTickSpacing",
                type: "int24",
            },
        ],
        name: "setTickSpacing",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "recipient",
                type: "address",
            },
            {
                internalType: "bool",
                name: "zeroToOne",
                type: "bool",
            },
            {
                internalType: "int256",
                name: "amountRequired",
                type: "int256",
            },
            {
                internalType: "uint160",
                name: "limitSqrtPrice",
                type: "uint160",
            },
            {
                internalType: "bytes",
                name: "data",
                type: "bytes",
            },
        ],
        name: "swap",
        outputs: [
            {
                internalType: "int256",
                name: "amount0",
                type: "int256",
            },
            {
                internalType: "int256",
                name: "amount1",
                type: "int256",
            },
        ],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "leftoversRecipient",
                type: "address",
            },
            {
                internalType: "address",
                name: "recipient",
                type: "address",
            },
            {
                internalType: "bool",
                name: "zeroToOne",
                type: "bool",
            },
            {
                internalType: "int256",
                name: "amountToSell",
                type: "int256",
            },
            {
                internalType: "uint160",
                name: "limitSqrtPrice",
                type: "uint160",
            },
            {
                internalType: "bytes",
                name: "data",
                type: "bytes",
            },
        ],
        name: "swapWithPaymentInAdvance",
        outputs: [
            {
                internalType: "int256",
                name: "amount0",
                type: "int256",
            },
            {
                internalType: "int256",
                name: "amount1",
                type: "int256",
            },
        ],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [],
        name: "tickSpacing",
        outputs: [
            {
                internalType: "int24",
                name: "",
                type: "int24",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "int16",
                name: "",
                type: "int16",
            },
        ],
        name: "tickTable",
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
        name: "tickTreeRoot",
        outputs: [
            {
                internalType: "uint32",
                name: "",
                type: "uint32",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "int16",
                name: "",
                type: "int16",
            },
        ],
        name: "tickTreeSecondLayer",
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
        inputs: [
            {
                internalType: "int24",
                name: "",
                type: "int24",
            },
        ],
        name: "ticks",
        outputs: [
            {
                internalType: "uint256",
                name: "liquidityTotal",
                type: "uint256",
            },
            {
                internalType: "int128",
                name: "liquidityDelta",
                type: "int128",
            },
            {
                internalType: "int24",
                name: "prevTick",
                type: "int24",
            },
            {
                internalType: "int24",
                name: "nextTick",
                type: "int24",
            },
            {
                internalType: "uint256",
                name: "outerFeeGrowth0Token",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "outerFeeGrowth1Token",
                type: "uint256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "token0",
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
        name: "token1",
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
        name: "totalFeeGrowth0Token",
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
        name: "totalFeeGrowth1Token",
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
] as const;
