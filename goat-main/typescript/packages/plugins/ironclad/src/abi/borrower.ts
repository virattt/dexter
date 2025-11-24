export const BORROWER_ABI = [
    {
        inputs: [
            {
                internalType: "address",
                name: "target",
                type: "address",
            },
        ],
        name: "AddressEmptyCode",
        type: "error",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "account",
                type: "address",
            },
        ],
        name: "AddressInsufficientBalance",
        type: "error",
    },
    {
        inputs: [],
        name: "FailedInnerCall",
        type: "error",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "token",
                type: "address",
            },
        ],
        name: "SafeERC20FailedOperation",
        type: "error",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "address",
                name: "_activePoolAddress",
                type: "address",
            },
        ],
        name: "ActivePoolAddressChanged",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "address",
                name: "_collSurplusPoolAddress",
                type: "address",
            },
        ],
        name: "CollSurplusPoolAddressChanged",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "address",
                name: "_newCollateralConfigAddress",
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
                indexed: false,
                internalType: "address",
                name: "_defaultPoolAddress",
                type: "address",
            },
        ],
        name: "DefaultPoolAddressChanged",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "address",
                name: "_gasPoolAddress",
                type: "address",
            },
        ],
        name: "GasPoolAddressChanged",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "address",
                name: "_helperAddress",
                type: "address",
            },
        ],
        name: "HelperAddressChanged",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "address",
                name: "_borrower",
                type: "address",
            },
            {
                indexed: false,
                internalType: "address",
                name: "_collateral",
                type: "address",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "_LUSDFee",
                type: "uint256",
            },
        ],
        name: "LUSDBorrowingFeePaid",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "address",
                name: "_lusdTokenAddress",
                type: "address",
            },
        ],
        name: "LUSDTokenAddressChanged",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "address",
                name: "_leverager",
                type: "address",
            },
        ],
        name: "LeveragerAddressChanged",
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
                name: "_newPriceFeedAddress",
                type: "address",
            },
        ],
        name: "PriceFeedAddressChanged",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "address",
                name: "_borrower",
                type: "address",
            },
            {
                indexed: false,
                internalType: "bool",
                name: "_isExempt",
                type: "bool",
            },
        ],
        name: "SetFeeExemption",
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
                name: "_treasuryAddress",
                type: "address",
            },
        ],
        name: "TreasuryAddressChanged",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "address",
                name: "_borrower",
                type: "address",
            },
            {
                indexed: false,
                internalType: "address",
                name: "_collateral",
                type: "address",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "arrayIndex",
                type: "uint256",
            },
        ],
        name: "TroveCreated",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "address",
                name: "_newTroveManagerAddress",
                type: "address",
            },
        ],
        name: "TroveManagerAddressChanged",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "address",
                name: "_borrower",
                type: "address",
            },
            {
                indexed: false,
                internalType: "address",
                name: "_collateral",
                type: "address",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "_debt",
                type: "uint256",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "_coll",
                type: "uint256",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "stake",
                type: "uint256",
            },
            {
                indexed: false,
                internalType: "enum IBorrowerOperations.BorrowerOperation",
                name: "operation",
                type: "uint8",
            },
        ],
        name: "TroveUpdated",
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
        inputs: [
            {
                internalType: "address",
                name: "_collateral",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "_collAmount",
                type: "uint256",
            },
            {
                internalType: "address",
                name: "_upperHint",
                type: "address",
            },
            {
                internalType: "address",
                name: "_lowerHint",
                type: "address",
            },
        ],
        name: "addColl",
        outputs: [],
        stateMutability: "nonpayable",
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
                name: "_maxFeePercentage",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "_collTopUp",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "_collWithdrawal",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "_LUSDChange",
                type: "uint256",
            },
            {
                internalType: "bool",
                name: "_isDebtIncrease",
                type: "bool",
            },
            {
                internalType: "address",
                name: "_upperHint",
                type: "address",
            },
            {
                internalType: "address",
                name: "_lowerHint",
                type: "address",
            },
        ],
        name: "adjustTrove",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                components: [
                    {
                        internalType: "address",
                        name: "_borrower",
                        type: "address",
                    },
                    {
                        internalType: "address",
                        name: "_collateral",
                        type: "address",
                    },
                    {
                        internalType: "uint256",
                        name: "_maxFeePercentage",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "_collTopUp",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "_collWithdrawal",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "_LUSDChange",
                        type: "uint256",
                    },
                    {
                        internalType: "bool",
                        name: "_isDebtIncrease",
                        type: "bool",
                    },
                    {
                        internalType: "address",
                        name: "_upperHint",
                        type: "address",
                    },
                    {
                        internalType: "address",
                        name: "_lowerHint",
                        type: "address",
                    },
                ],
                internalType: "struct IBorrowerOperations.Params_adjustTroveFor",
                name: "params",
                type: "tuple",
            },
        ],
        name: "adjustTroveFor",
        outputs: [
            {
                internalType: "address",
                name: "",
                type: "address",
            },
            {
                internalType: "address",
                name: "",
                type: "address",
            },
        ],
        stateMutability: "nonpayable",
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
        name: "claimCollateral",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "_borrower",
                type: "address",
            },
            {
                internalType: "address",
                name: "_collateral",
                type: "address",
            },
        ],
        name: "claimCollateralFor",
        outputs: [],
        stateMutability: "nonpayable",
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
        name: "closeTrove",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "_borrower",
                type: "address",
            },
            {
                internalType: "address",
                name: "_collateral",
                type: "address",
            },
        ],
        name: "closeTroveFor",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [],
        name: "collSurplusPool",
        outputs: [
            {
                internalType: "contract ICollSurplusPool",
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
                name: "",
                type: "address",
            },
        ],
        name: "exemptFromFee",
        outputs: [
            {
                internalType: "bool",
                name: "",
                type: "bool",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "gasPoolAddress",
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
                name: "_debt",
                type: "uint256",
            },
        ],
        name: "getCompositeDebt",
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
        inputs: [],
        name: "helperAddress",
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
        name: "initialized",
        outputs: [
            {
                internalType: "bool",
                name: "",
                type: "bool",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "leveragerAddress",
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
        name: "lusdToken",
        outputs: [
            {
                internalType: "contract ILUSDToken",
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
                name: "_collAmount",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "_maxFeePercentage",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "_LUSDAmount",
                type: "uint256",
            },
            {
                internalType: "address",
                name: "_upperHint",
                type: "address",
            },
            {
                internalType: "address",
                name: "_lowerHint",
                type: "address",
            },
        ],
        name: "openTrove",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "_borrower",
                type: "address",
            },
            {
                internalType: "address",
                name: "_collateral",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "_collAmount",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "_maxFeePercentage",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "_LUSDAmount",
                type: "uint256",
            },
            {
                internalType: "address",
                name: "_upperHint",
                type: "address",
            },
            {
                internalType: "address",
                name: "_lowerHint",
                type: "address",
            },
        ],
        name: "openTroveFor",
        outputs: [
            {
                internalType: "address",
                name: "",
                type: "address",
            },
            {
                internalType: "address",
                name: "",
                type: "address",
            },
        ],
        stateMutability: "nonpayable",
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
                name: "_collateral",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "_LUSDAmount",
                type: "uint256",
            },
            {
                internalType: "address",
                name: "_upperHint",
                type: "address",
            },
            {
                internalType: "address",
                name: "_lowerHint",
                type: "address",
            },
        ],
        name: "repayLUSD",
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
                name: "_troveManagerAddress",
                type: "address",
            },
            {
                internalType: "address",
                name: "_activePoolAddress",
                type: "address",
            },
            {
                internalType: "address",
                name: "_defaultPoolAddress",
                type: "address",
            },
            {
                internalType: "address",
                name: "_gasPoolAddress",
                type: "address",
            },
            {
                internalType: "address",
                name: "_collSurplusPoolAddress",
                type: "address",
            },
            {
                internalType: "address",
                name: "_priceFeedAddress",
                type: "address",
            },
            {
                internalType: "address",
                name: "_sortedTrovesAddress",
                type: "address",
            },
            {
                internalType: "address",
                name: "_lusdTokenAddress",
                type: "address",
            },
            {
                internalType: "address",
                name: "_treasury",
                type: "address",
            },
            {
                internalType: "address",
                name: "_leveragerAddress",
                type: "address",
            },
            {
                internalType: "address",
                name: "_helperAddress",
                type: "address",
            },
        ],
        name: "setAddresses",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "_borrower",
                type: "address",
            },
            {
                internalType: "bool",
                name: "_isExempt",
                type: "bool",
            },
        ],
        name: "setExemptFromFee",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "_helperAddress",
                type: "address",
            },
        ],
        name: "setHelperAddress",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "_leveragerAddress",
                type: "address",
            },
        ],
        name: "setLeveragerAddress",
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
        name: "treasury",
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
    {
        inputs: [
            {
                internalType: "address",
                name: "_collateral",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "_collWithdrawal",
                type: "uint256",
            },
            {
                internalType: "address",
                name: "_upperHint",
                type: "address",
            },
            {
                internalType: "address",
                name: "_lowerHint",
                type: "address",
            },
        ],
        name: "withdrawColl",
        outputs: [],
        stateMutability: "nonpayable",
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
                name: "_maxFeePercentage",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "_LUSDAmount",
                type: "uint256",
            },
            {
                internalType: "address",
                name: "_upperHint",
                type: "address",
            },
            {
                internalType: "address",
                name: "_lowerHint",
                type: "address",
            },
        ],
        name: "withdrawLUSD",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
] as const;
