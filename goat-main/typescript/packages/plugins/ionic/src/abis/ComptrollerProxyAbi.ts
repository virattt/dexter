export const ComptrollerProxyAbi = [
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "address",
                name: "rewardsDistributor",
                type: "address",
            },
        ],
        name: "AddedRewardsDistributor",
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
                internalType: "contract ICErc20",
                name: "cToken",
                type: "address",
            },
            {
                indexed: false,
                internalType: "address",
                name: "account",
                type: "address",
            },
        ],
        name: "MarketEntered",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "contract ICErc20",
                name: "cToken",
                type: "address",
            },
            {
                indexed: false,
                internalType: "address",
                name: "account",
                type: "address",
            },
        ],
        name: "MarketExited",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "contract ICErc20",
                name: "cToken",
                type: "address",
            },
        ],
        name: "MarketListed",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "uint256",
                name: "oldCloseFactorMantissa",
                type: "uint256",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "newCloseFactorMantissa",
                type: "uint256",
            },
        ],
        name: "NewCloseFactor",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "contract ICErc20",
                name: "cToken",
                type: "address",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "oldCollateralFactorMantissa",
                type: "uint256",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "newCollateralFactorMantissa",
                type: "uint256",
            },
        ],
        name: "NewCollateralFactor",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "uint256",
                name: "oldLiquidationIncentiveMantissa",
                type: "uint256",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "newLiquidationIncentiveMantissa",
                type: "uint256",
            },
        ],
        name: "NewLiquidationIncentive",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "contract BasePriceOracle",
                name: "oldPriceOracle",
                type: "address",
            },
            {
                indexed: false,
                internalType: "contract BasePriceOracle",
                name: "newPriceOracle",
                type: "address",
            },
        ],
        name: "NewPriceOracle",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "bool",
                name: "enforce",
                type: "bool",
            },
        ],
        name: "WhitelistEnforcementChanged",
        type: "event",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "distributor",
                type: "address",
            },
        ],
        name: "_addRewardsDistributor",
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
        name: "_afterNonReentrant",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [],
        name: "_becomeImplementation",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [],
        name: "_beforeNonReentrant",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [],
        name: "_borrowGuardianPaused",
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
        inputs: [
            {
                internalType: "uint8",
                name: "delegateType",
                type: "uint8",
            },
            {
                internalType: "bytes",
                name: "constructorData",
                type: "bytes",
            },
            {
                internalType: "bytes",
                name: "becomeImplData",
                type: "bytes",
            },
            {
                internalType: "uint256",
                name: "collateralFactorMantissa",
                type: "uint256",
            },
        ],
        name: "_deployMarket",
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
        inputs: [],
        name: "_mintGuardianPaused",
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
        inputs: [
            {
                internalType: "uint256",
                name: "newCloseFactorMantissa",
                type: "uint256",
            },
        ],
        name: "_setCloseFactor",
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
                internalType: "contract ICErc20",
                name: "cToken",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "newCollateralFactorMantissa",
                type: "uint256",
            },
        ],
        name: "_setCollateralFactor",
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
                name: "newLiquidationIncentiveMantissa",
                type: "uint256",
            },
        ],
        name: "_setLiquidationIncentive",
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
                internalType: "contract BasePriceOracle",
                name: "newOracle",
                type: "address",
            },
        ],
        name: "_setPriceOracle",
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
                internalType: "bool",
                name: "enforce",
                type: "bool",
            },
        ],
        name: "_setWhitelistEnforcement",
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
                internalType: "address[]",
                name: "suppliers",
                type: "address[]",
            },
            {
                internalType: "bool[]",
                name: "statuses",
                type: "bool[]",
            },
        ],
        name: "_setWhitelistStatuses",
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
                name: "",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        name: "accountAssets",
        outputs: [
            {
                internalType: "contract ICErc20",
                name: "",
                type: "address",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "admin",
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
        name: "adminHasRights",
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
        inputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        name: "allBorrowers",
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
                name: "",
                type: "uint256",
            },
        ],
        name: "allMarkets",
        outputs: [
            {
                internalType: "contract ICErc20",
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
                name: "cToken",
                type: "address",
            },
            {
                internalType: "address",
                name: "borrower",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "borrowAmount",
                type: "uint256",
            },
        ],
        name: "borrowAllowed",
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
                name: "",
                type: "address",
            },
            {
                internalType: "address",
                name: "",
                type: "address",
            },
        ],
        name: "borrowCapForCollateral",
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
        name: "borrowCapGuardian",
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
                name: "",
                type: "address",
            },
        ],
        name: "borrowCaps",
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
                name: "",
                type: "address",
            },
        ],
        name: "borrowGuardianPaused",
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
        inputs: [
            {
                internalType: "address",
                name: "cToken",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "accountBorrowsNew",
                type: "uint256",
            },
        ],
        name: "borrowWithinLimits",
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
                name: "",
                type: "address",
            },
            {
                internalType: "address",
                name: "",
                type: "address",
            },
        ],
        name: "borrowingAgainstCollateralBlacklist",
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
        inputs: [
            {
                internalType: "address",
                name: "",
                type: "address",
            },
        ],
        name: "cTokensByUnderlying",
        outputs: [
            {
                internalType: "contract ICErc20",
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
                name: "account",
                type: "address",
            },
            {
                internalType: "contract ICErc20",
                name: "cToken",
                type: "address",
            },
        ],
        name: "checkMembership",
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
        name: "closeFactorMantissa",
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
        name: "enforceWhitelist",
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
        inputs: [
            {
                internalType: "address[]",
                name: "cTokens",
                type: "address[]",
            },
        ],
        name: "enterMarkets",
        outputs: [
            {
                internalType: "uint256[]",
                name: "",
                type: "uint256[]",
            },
        ],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "cTokenAddress",
                type: "address",
            },
        ],
        name: "exitMarket",
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
                name: "account",
                type: "address",
            },
        ],
        name: "getAccountLiquidity",
        outputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
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
                name: "account",
                type: "address",
            },
        ],
        name: "getAssetsIn",
        outputs: [
            {
                internalType: "contract ICErc20[]",
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
                internalType: "address",
                name: "account",
                type: "address",
            },
            {
                internalType: "address",
                name: "cTokenModify",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "redeemTokens",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "borrowAmount",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "repayAmount",
                type: "uint256",
            },
        ],
        name: "getHypotheticalAccountLiquidity",
        outputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
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
                name: "account",
                type: "address",
            },
            {
                internalType: "contract ICErc20",
                name: "cTokenModify",
                type: "address",
            },
            {
                internalType: "bool",
                name: "isBorrow",
                type: "bool",
            },
        ],
        name: "getMaxRedeemOrBorrow",
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
        name: "ionicAdminHasRights",
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
        name: "isComptroller",
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
        inputs: [
            {
                internalType: "contract ICErc20",
                name: "cToken",
                type: "address",
            },
        ],
        name: "isDeprecated",
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
        inputs: [
            {
                internalType: "address",
                name: "cTokenBorrowed",
                type: "address",
            },
            {
                internalType: "address",
                name: "cTokenCollateral",
                type: "address",
            },
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
                name: "repayAmount",
                type: "uint256",
            },
        ],
        name: "liquidateBorrowAllowed",
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
                name: "cTokenBorrowed",
                type: "address",
            },
            {
                internalType: "address",
                name: "cTokenCollateral",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "actualRepayAmount",
                type: "uint256",
            },
        ],
        name: "liquidateCalculateSeizeTokens",
        outputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
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
        name: "liquidationIncentiveMantissa",
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
                name: "",
                type: "address",
            },
        ],
        name: "markets",
        outputs: [
            {
                internalType: "bool",
                name: "isListed",
                type: "bool",
            },
            {
                internalType: "uint256",
                name: "collateralFactorMantissa",
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
                name: "cTokenAddress",
                type: "address",
            },
            {
                internalType: "address",
                name: "minter",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "mintAmount",
                type: "uint256",
            },
        ],
        name: "mintAllowed",
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
                name: "",
                type: "address",
            },
        ],
        name: "mintGuardianPaused",
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
        inputs: [
            {
                internalType: "address",
                name: "cToken",
                type: "address",
            },
            {
                internalType: "address",
                name: "minter",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "actualMintAmount",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "mintTokens",
                type: "uint256",
            },
        ],
        name: "mintVerify",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        name: "nonAccruingRewardsDistributors",
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
        name: "oracle",
        outputs: [
            {
                internalType: "contract BasePriceOracle",
                name: "",
                type: "address",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "pauseGuardian",
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
        name: "pendingAdmin",
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
                name: "cToken",
                type: "address",
            },
            {
                internalType: "address",
                name: "redeemer",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "redeemTokens",
                type: "uint256",
            },
        ],
        name: "redeemAllowed",
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
                name: "cToken",
                type: "address",
            },
            {
                internalType: "address",
                name: "redeemer",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "redeemAmount",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "redeemTokens",
                type: "uint256",
            },
        ],
        name: "redeemVerify",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "cToken",
                type: "address",
            },
            {
                internalType: "address",
                name: "payer",
                type: "address",
            },
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
        name: "repayBorrowAllowed",
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
                name: "",
                type: "uint256",
            },
        ],
        name: "rewardsDistributors",
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
                name: "cTokenCollateral",
                type: "address",
            },
            {
                internalType: "address",
                name: "cTokenBorrowed",
                type: "address",
            },
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
        name: "seizeAllowed",
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
        name: "seizeGuardianPaused",
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
        inputs: [
            {
                internalType: "address",
                name: "",
                type: "address",
            },
        ],
        name: "suppliers",
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
        inputs: [
            {
                internalType: "address",
                name: "",
                type: "address",
            },
        ],
        name: "supplyCaps",
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
                name: "cToken",
                type: "address",
            },
            {
                internalType: "address",
                name: "src",
                type: "address",
            },
            {
                internalType: "address",
                name: "dst",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "transferTokens",
                type: "uint256",
            },
        ],
        name: "transferAllowed",
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
        name: "transferGuardianPaused",
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
        inputs: [
            {
                internalType: "address",
                name: "",
                type: "address",
            },
        ],
        name: "whitelist",
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
        inputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        name: "whitelistArray",
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
