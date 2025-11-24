export const HINT_HELPERS_ABI = [
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "address",
                name: "_collateralConfigAddress",
                type: "address",
            },
        ],
        name: "CollateralConfigAddressChanged",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "address",
                name: "previousOwner",
                type: "address",
            },
            {
                indexed: true,
                internalType: "address",
                name: "newOwner",
                type: "address",
            },
        ],
        name: "OwnershipTransferred",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "address",
                name: "_sortedTrovesAddress",
                type: "address",
            },
        ],
        name: "SortedTrovesAddressChanged",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "address",
                name: "_troveManagerAddress",
                type: "address",
            },
        ],
        name: "TroveManagerAddressChanged",
        type: "event",
    },
    {
        inputs: [],
        name: "BORROWING_FEE_FLOOR",
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
        name: "DECIMAL_PRECISION",
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
        name: "LUSD_GAS_COMPENSATION",
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
        name: "MIN_NET_DEBT",
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
        name: "NAME",
        outputs: [
            {
                internalType: "string",
                name: "",
                type: "string",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "PERCENT_DIVISOR",
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
        name: "_100pct",
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
        name: "activePool",
        outputs: [
            {
                internalType: "contract IActivePool",
                name: "",
                type: "address",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "collateralConfig",
        outputs: [
            {
                internalType: "contract ICollateralConfig",
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
                name: "_coll",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "_debt",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "_price",
                type: "uint256",
            },
            {
                internalType: "uint8",
                name: "_collDecimals",
                type: "uint8",
            },
        ],
        name: "computeCR",
        outputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        stateMutability: "pure",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "_coll",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "_debt",
                type: "uint256",
            },
            {
                internalType: "uint8",
                name: "_collDecimals",
                type: "uint8",
            },
        ],
        name: "computeNominalCR",
        outputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        stateMutability: "pure",
        type: "function",
    },
    {
        inputs: [],
        name: "defaultPool",
        outputs: [
            {
                internalType: "contract IDefaultPool",
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
                name: "_collateral",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "_CR",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "_numTrials",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "_inputRandomSeed",
                type: "uint256",
            },
        ],
        name: "getApproxHint",
        outputs: [
            {
                internalType: "address",
                name: "hintAddress",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "diff",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "latestRandomSeed",
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
                name: "_collateral",
                type: "address",
            },
        ],
        name: "getEntireSystemColl",
        outputs: [
            {
                internalType: "uint256",
                name: "entireSystemColl",
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
                name: "_collateral",
                type: "address",
            },
        ],
        name: "getEntireSystemDebt",
        outputs: [
            {
                internalType: "uint256",
                name: "entireSystemDebt",
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
                name: "_collateral",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "_LUSDamount",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "_price",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "_maxIterations",
                type: "uint256",
            },
        ],
        name: "getRedemptionHints",
        outputs: [
            {
                internalType: "address",
                name: "firstRedemptionHint",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "partialRedemptionHintNICR",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "truncatedLUSDamount",
                type: "uint256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "owner",
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
        name: "priceFeed",
        outputs: [
            {
                internalType: "contract IPriceFeed",
                name: "",
                type: "address",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "renounceOwnership",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "_collateralConfigAddress",
                type: "address",
            },
            {
                internalType: "address",
                name: "_sortedTrovesAddress",
                type: "address",
            },
            {
                internalType: "address",
                name: "_troveManagerAddress",
                type: "address",
            },
        ],
        name: "setAddresses",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [],
        name: "sortedTroves",
        outputs: [
            {
                internalType: "contract ISortedTroves",
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
                name: "newOwner",
                type: "address",
            },
        ],
        name: "transferOwnership",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [],
        name: "troveManager",
        outputs: [
            {
                internalType: "contract ITroveManager",
                name: "",
                type: "address",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
] as const;
