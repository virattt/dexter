export const cerc20DelegatorAbi = [
    {
        inputs: [
            {
                internalType: "address",
                name: "underlying_",
                type: "address",
            },
            {
                internalType: "contract IonicComptroller",
                name: "comptroller_",
                type: "address",
            },
            {
                internalType: "address payable",
                name: "ionicAdmin_",
                type: "address",
            },
            {
                internalType: "contract InterestRateModel",
                name: "interestRateModel_",
                type: "address",
            },
            {
                internalType: "string",
                name: "name_",
                type: "string",
            },
            {
                internalType: "string",
                name: "symbol_",
                type: "string",
            },
            {
                internalType: "uint256",
                name: "reserveFactorMantissa_",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "adminFeeMantissa_",
                type: "uint256",
            },
        ],
        stateMutability: "nonpayable",
        type: "constructor",
    },
    {
        inputs: [
            {
                internalType: "bytes4",
                name: "_functionSelector",
                type: "bytes4",
            },
            {
                internalType: "address",
                name: "_currentImpl",
                type: "address",
            },
        ],
        name: "FunctionAlreadyAdded",
        type: "error",
    },
    {
        inputs: [
            {
                internalType: "bytes4",
                name: "_functionSelector",
                type: "bytes4",
            },
        ],
        name: "FunctionNotFound",
        type: "error",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "uint256",
                name: "cashPrior",
                type: "uint256",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "interestAccumulated",
                type: "uint256",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "borrowIndex",
                type: "uint256",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "totalBorrows",
                type: "uint256",
            },
        ],
        name: "AccrueInterest",
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
                indexed: true,
                internalType: "address",
                name: "spender",
                type: "address",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "amount",
                type: "uint256",
            },
        ],
        name: "Approval",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "address",
                name: "borrower",
                type: "address",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "borrowAmount",
                type: "uint256",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "accountBorrows",
                type: "uint256",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "totalBorrows",
                type: "uint256",
            },
        ],
        name: "Borrow",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "address",
                name: "liquidator",
                type: "address",
            },
            {
                indexed: false,
                internalType: "address",
                name: "borrower",
                type: "address",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "repayAmount",
                type: "uint256",
            },
            {
                indexed: false,
                internalType: "address",
                name: "cTokenCollateral",
                type: "address",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "seizeTokens",
                type: "uint256",
            },
        ],
        name: "LiquidateBorrow",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "address",
                name: "minter",
                type: "address",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "mintAmount",
                type: "uint256",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "mintTokens",
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
                internalType: "uint256",
                name: "oldAdminFeeMantissa",
                type: "uint256",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "newAdminFeeMantissa",
                type: "uint256",
            },
        ],
        name: "NewAdminFee",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "address",
                name: "oldImplementation",
                type: "address",
            },
            {
                indexed: false,
                internalType: "address",
                name: "newImplementation",
                type: "address",
            },
        ],
        name: "NewImplementation",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "uint256",
                name: "oldIonicFeeMantissa",
                type: "uint256",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "newIonicFeeMantissa",
                type: "uint256",
            },
        ],
        name: "NewIonicFee",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "contract InterestRateModel",
                name: "oldInterestRateModel",
                type: "address",
            },
            {
                indexed: false,
                internalType: "contract InterestRateModel",
                name: "newInterestRateModel",
                type: "address",
            },
        ],
        name: "NewMarketInterestRateModel",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "uint256",
                name: "oldReserveFactorMantissa",
                type: "uint256",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "newReserveFactorMantissa",
                type: "uint256",
            },
        ],
        name: "NewReserveFactor",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "address",
                name: "redeemer",
                type: "address",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "redeemAmount",
                type: "uint256",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "redeemTokens",
                type: "uint256",
            },
        ],
        name: "Redeem",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "address",
                name: "payer",
                type: "address",
            },
            {
                indexed: false,
                internalType: "address",
                name: "borrower",
                type: "address",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "repayAmount",
                type: "uint256",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "accountBorrows",
                type: "uint256",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "totalBorrows",
                type: "uint256",
            },
        ],
        name: "RepayBorrow",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "address",
                name: "benefactor",
                type: "address",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "addAmount",
                type: "uint256",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "newTotalReserves",
                type: "uint256",
            },
        ],
        name: "ReservesAdded",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "address",
                name: "admin",
                type: "address",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "reduceAmount",
                type: "uint256",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "newTotalReserves",
                type: "uint256",
            },
        ],
        name: "ReservesReduced",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "address",
                name: "from",
                type: "address",
            },
            {
                indexed: true,
                internalType: "address",
                name: "to",
                type: "address",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "amount",
                type: "uint256",
            },
        ],
        name: "Transfer",
        type: "event",
    },
    {
        stateMutability: "nonpayable",
        type: "fallback",
    },
    {
        inputs: [],
        name: "_listExtensions",
        outputs: [
            {
                internalType: "address[]",
                name: "",
                type: "address[]",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "contract DiamondExtension",
                name: "extensionToAdd",
                type: "address",
            },
            {
                internalType: "contract DiamondExtension",
                name: "extensionToReplace",
                type: "address",
            },
        ],
        name: "_registerExtension",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "implementation_",
                type: "address",
            },
            {
                internalType: "bytes",
                name: "becomeImplementationData",
                type: "bytes",
            },
        ],
        name: "_setImplementationSafe",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [],
        name: "_upgrade",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [],
        name: "accrualBlockNumber",
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
        name: "adminFeeMantissa",
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
        name: "borrowIndex",
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
        name: "comptroller",
        outputs: [
            {
                internalType: "contract IonicComptroller",
                name: "",
                type: "address",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "decimals",
        outputs: [
            {
                internalType: "uint8",
                name: "",
                type: "uint8",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "feeSeizeShareMantissa",
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
        name: "implementation",
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
        name: "interestRateModel",
        outputs: [
            {
                internalType: "contract InterestRateModel",
                name: "",
                type: "address",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "ionicAdmin",
        outputs: [
            {
                internalType: "address payable",
                name: "",
                type: "address",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "ionicFeeMantissa",
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
        name: "name",
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
        name: "protocolSeizeShareMantissa",
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
        name: "reserveFactorMantissa",
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
        name: "symbol",
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
        name: "totalAdminFees",
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
        name: "totalBorrows",
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
        name: "totalIonicFees",
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
        name: "totalReserves",
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
        name: "totalSupply",
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
        name: "underlying",
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
        type: "function",
        inputs: [{ name: "owner", internalType: "address", type: "address" }],
        name: "balanceOf",
        outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [{ name: "owner", internalType: "address", type: "address" }],
        name: "balanceOfUnderlying",
        outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [{ name: "account", internalType: "address", type: "address" }],
        name: "borrowBalanceCurrent",
        outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [],
        name: "borrowIndex",
        outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [],
        name: "borrowRatePerBlock",
        outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [{ name: "borrowAmount", internalType: "uint256", type: "uint256" }],
        name: "borrowRatePerBlockAfterBorrow",
        outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
        stateMutability: "view",
    },
    // custom added
    {
        type: "function",
        inputs: [{ name: "owner", internalType: "address", type: "address" }],
        name: "balanceOfUnderlying",
        outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [{ name: "account", internalType: "address", type: "address" }],
        name: "borrowBalanceCurrent",
        outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [],
        name: "borrowIndex",
        outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [],
        name: "borrowRatePerBlock",
        outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [{ name: "borrowAmount", internalType: "uint256", type: "uint256" }],
        name: "borrowRatePerBlockAfterBorrow",
        outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [],
        name: "exchangeRateCurrent",
        outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [],
        name: "exchangeRateStored",
        outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [],
        name: "feeSeizeShareMantissa",
        outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [],
        name: "getCash",
        outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [],
        name: "getTotalUnderlyingSupplied",
        outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [],
        name: "ionicAdminHasRights",
        outputs: [{ name: "", internalType: "bool", type: "bool" }],
        stateMutability: "view",
    },
] as const;
