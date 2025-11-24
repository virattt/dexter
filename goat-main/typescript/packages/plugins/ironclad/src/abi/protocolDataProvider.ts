export const PROTOCOL_DATA_PROVIDER_ABI = [
    {
        inputs: [
            {
                internalType: "contract ILendingPoolAddressesProvider",
                name: "addressesProvider",
                type: "address",
            },
        ],
        stateMutability: "nonpayable",
        type: "constructor",
    },
    {
        inputs: [],
        name: "ADDRESSES_PROVIDER",
        outputs: [
            {
                internalType: "contract ILendingPoolAddressesProvider",
                name: "",
                type: "address",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "getAllATokens",
        outputs: [
            {
                components: [
                    {
                        internalType: "string",
                        name: "symbol",
                        type: "string",
                    },
                    {
                        internalType: "address",
                        name: "tokenAddress",
                        type: "address",
                    },
                ],
                internalType: "struct ProtocolDataProvider.TokenData[]",
                name: "",
                type: "tuple[]",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "getAllReservesTokens",
        outputs: [
            {
                components: [
                    {
                        internalType: "string",
                        name: "symbol",
                        type: "string",
                    },
                    {
                        internalType: "address",
                        name: "tokenAddress",
                        type: "address",
                    },
                ],
                internalType: "struct ProtocolDataProvider.TokenData[]",
                name: "",
                type: "tuple[]",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "asset",
                type: "address",
            },
        ],
        name: "getReserveConfigurationData",
        outputs: [
            {
                internalType: "uint256",
                name: "decimals",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "ltv",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "liquidationThreshold",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "liquidationBonus",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "reserveFactor",
                type: "uint256",
            },
            {
                internalType: "bool",
                name: "usageAsCollateralEnabled",
                type: "bool",
            },
            {
                internalType: "bool",
                name: "borrowingEnabled",
                type: "bool",
            },
            {
                internalType: "bool",
                name: "stableBorrowRateEnabled",
                type: "bool",
            },
            {
                internalType: "bool",
                name: "isActive",
                type: "bool",
            },
            {
                internalType: "bool",
                name: "isFrozen",
                type: "bool",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "asset",
                type: "address",
            },
        ],
        name: "getReserveData",
        outputs: [
            {
                internalType: "uint256",
                name: "availableLiquidity",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "totalStableDebt",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "totalVariableDebt",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "liquidityRate",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "variableBorrowRate",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "stableBorrowRate",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "averageStableBorrowRate",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "liquidityIndex",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "variableBorrowIndex",
                type: "uint256",
            },
            {
                internalType: "uint40",
                name: "lastUpdateTimestamp",
                type: "uint40",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "asset",
                type: "address",
            },
        ],
        name: "getReserveTokensAddresses",
        outputs: [
            {
                internalType: "address",
                name: "aTokenAddress",
                type: "address",
            },
            {
                internalType: "address",
                name: "stableDebtTokenAddress",
                type: "address",
            },
            {
                internalType: "address",
                name: "variableDebtTokenAddress",
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
                name: "asset",
                type: "address",
            },
            {
                internalType: "address",
                name: "user",
                type: "address",
            },
        ],
        name: "getUserReserveData",
        outputs: [
            {
                internalType: "uint256",
                name: "currentATokenBalance",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "currentStableDebt",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "currentVariableDebt",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "principalStableDebt",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "scaledVariableDebt",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "stableBorrowRate",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "liquidityRate",
                type: "uint256",
            },
            {
                internalType: "uint40",
                name: "stableRateLastUpdated",
                type: "uint40",
            },
            {
                internalType: "bool",
                name: "usageAsCollateralEnabled",
                type: "bool",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
] as const;
