export const poolAbi = [
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
                internalType: "uint256",
                name: "error",
                type: "uint256",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "info",
                type: "uint256",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "detail",
                type: "uint256",
            },
        ],
        name: "Failure",
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
        inputs: [
            {
                internalType: "bytes",
                name: "",
                type: "bytes",
            },
        ],
        name: "_becomeImplementation",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [],
        name: "_getExtensionFunctions",
        outputs: [
            {
                internalType: "bytes4[]",
                name: "functionSelectors",
                type: "bytes4[]",
            },
        ],
        stateMutability: "pure",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "withdrawAmount",
                type: "uint256",
            },
        ],
        name: "_withdrawAdminFees",
        outputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "withdrawAmount",
                type: "uint256",
            },
        ],
        name: "_withdrawIonicFees",
        outputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
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
        name: "ap",
        outputs: [
            {
                internalType: "contract AddressesProvider",
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
                name: "_token",
                type: "address",
            },
            {
                internalType: "address",
                name: "_spender",
                type: "address",
            },
        ],
        name: "approve",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "borrowAmount",
                type: "uint256",
            },
        ],
        name: "borrow",
        outputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        stateMutability: "nonpayable",
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
        name: "claim",
        outputs: [],
        stateMutability: "nonpayable",
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
        name: "contractType",
        outputs: [
            {
                internalType: "string",
                name: "",
                type: "string",
            },
        ],
        stateMutability: "pure",
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
        name: "delegateType",
        outputs: [
            {
                internalType: "uint8",
                name: "",
                type: "uint8",
            },
        ],
        stateMutability: "pure",
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
        name: "getCash",
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
        inputs: [
            {
                internalType: "address",
                name: "borrower",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "repayAmount",
                type: "uint256",
            },
            {
                internalType: "address",
                name: "cTokenCollateral",
                type: "address",
            },
        ],
        name: "liquidateBorrow",
        outputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "mintAmount",
                type: "uint256",
            },
        ],
        name: "mint",
        outputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        stateMutability: "nonpayable",
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
        inputs: [
            {
                internalType: "uint256",
                name: "redeemTokens",
                type: "uint256",
            },
        ],
        name: "redeem",
        outputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "redeemAmount",
                type: "uint256",
            },
        ],
        name: "redeemUnderlying",
        outputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "repayAmount",
                type: "uint256",
            },
        ],
        name: "repayBorrow",
        outputs: [
            {
                internalType: "uint256",
                name: "",
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
                name: "borrower",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "repayAmount",
                type: "uint256",
            },
        ],
        name: "repayBorrowBehalf",
        outputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        stateMutability: "nonpayable",
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
        inputs: [
            {
                internalType: "address",
                name: "liquidator",
                type: "address",
            },
            {
                internalType: "address",
                name: "borrower",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "seizeTokens",
                type: "uint256",
            },
        ],
        name: "seize",
        outputs: [
            {
                internalType: "uint256",
                name: "",
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
                name: "from",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "amount",
                type: "uint256",
            },
        ],
        name: "selfTransferIn",
        outputs: [
            {
                internalType: "uint256",
                name: "",
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
                name: "to",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "amount",
                type: "uint256",
            },
        ],
        name: "selfTransferOut",
        outputs: [],
        stateMutability: "nonpayable",
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
] as const;
