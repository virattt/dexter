export const ESCROW_CURVE_ABI = [
    {
        inputs: [],
        stateMutability: "nonpayable",
        type: "constructor",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "dao",
                type: "address",
            },
            {
                internalType: "address",
                name: "where",
                type: "address",
            },
            {
                internalType: "address",
                name: "who",
                type: "address",
            },
            {
                internalType: "bytes32",
                name: "permissionId",
                type: "bytes32",
            },
        ],
        name: "DaoUnauthorized",
        type: "error",
    },
    {
        inputs: [],
        name: "InvalidCheckpoint",
        type: "error",
    },
    {
        inputs: [],
        name: "InvalidTokenId",
        type: "error",
    },
    {
        inputs: [],
        name: "OnlyEscrow",
        type: "error",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "address",
                name: "previousAdmin",
                type: "address",
            },
            {
                indexed: false,
                internalType: "address",
                name: "newAdmin",
                type: "address",
            },
        ],
        name: "AdminChanged",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "address",
                name: "beacon",
                type: "address",
            },
        ],
        name: "BeaconUpgraded",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "uint8",
                name: "version",
                type: "uint8",
            },
        ],
        name: "Initialized",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "address",
                name: "implementation",
                type: "address",
            },
        ],
        name: "Upgraded",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "uint48",
                name: "warmup",
                type: "uint48",
            },
        ],
        name: "WarmupSet",
        type: "event",
    },
    {
        inputs: [],
        name: "CURVE_ADMIN_ROLE",
        outputs: [
            {
                internalType: "bytes32",
                name: "",
                type: "bytes32",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "amount",
                type: "uint256",
            },
        ],
        name: "_getCoefficients",
        outputs: [
            {
                internalType: "int256[3]",
                name: "",
                type: "int256[3]",
            },
        ],
        stateMutability: "pure",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "amount",
                type: "uint256",
            },
        ],
        name: "_getConstantCoeff",
        outputs: [
            {
                internalType: "int256",
                name: "",
                type: "int256",
            },
        ],
        stateMutability: "pure",
        type: "function",
    },
    {
        inputs: [
            {
                components: [
                    {
                        internalType: "uint256",
                        name: "bias",
                        type: "uint256",
                    },
                    {
                        internalType: "uint128",
                        name: "checkpointTs",
                        type: "uint128",
                    },
                    {
                        internalType: "uint128",
                        name: "writtenTs",
                        type: "uint128",
                    },
                    {
                        internalType: "int256[3]",
                        name: "coefficients",
                        type: "int256[3]",
                    },
                ],
                internalType: "struct IEscrowCurveTokenStorage.TokenPoint",
                name: "_point",
                type: "tuple",
            },
        ],
        name: "_isWarm",
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
                name: "_tokenId",
                type: "uint256",
            },
            {
                components: [
                    {
                        internalType: "uint208",
                        name: "amount",
                        type: "uint208",
                    },
                    {
                        internalType: "uint48",
                        name: "start",
                        type: "uint48",
                    },
                ],
                internalType: "struct ILockedBalanceIncreasing.LockedBalance",
                name: "_oldLocked",
                type: "tuple",
            },
            {
                components: [
                    {
                        internalType: "uint208",
                        name: "amount",
                        type: "uint208",
                    },
                    {
                        internalType: "uint48",
                        name: "start",
                        type: "uint48",
                    },
                ],
                internalType: "struct ILockedBalanceIncreasing.LockedBalance",
                name: "_newLocked",
                type: "tuple",
            },
        ],
        name: "checkpoint",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [],
        name: "clock",
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
        name: "dao",
        outputs: [
            {
                internalType: "contract IDAO",
                name: "",
                type: "address",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "escrow",
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
                name: "timeElapsed",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "amount",
                type: "uint256",
            },
        ],
        name: "getBias",
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
                name: "amount",
                type: "uint256",
            },
        ],
        name: "getCoefficients",
        outputs: [
            {
                internalType: "int256[3]",
                name: "",
                type: "int256[3]",
            },
        ],
        stateMutability: "pure",
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
        inputs: [
            {
                internalType: "address",
                name: "_escrow",
                type: "address",
            },
            {
                internalType: "address",
                name: "_dao",
                type: "address",
            },
            {
                internalType: "uint48",
                name: "_warmupPeriod",
                type: "uint48",
            },
            {
                internalType: "address",
                name: "_clock",
                type: "address",
            },
        ],
        name: "initialize",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "tokenId",
                type: "uint256",
            },
        ],
        name: "isWarm",
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
                name: "amount",
                type: "uint256",
            },
        ],
        name: "previewMaxBias",
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
        name: "proxiableUUID",
        outputs: [
            {
                internalType: "bytes32",
                name: "",
                type: "bytes32",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint48",
                name: "_warmupPeriod",
                type: "uint48",
            },
        ],
        name: "setWarmupPeriod",
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
        name: "supplyAt",
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
                name: "_tokenId",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "_tokenInterval",
                type: "uint256",
            },
        ],
        name: "tokenPointHistory",
        outputs: [
            {
                components: [
                    {
                        internalType: "uint256",
                        name: "bias",
                        type: "uint256",
                    },
                    {
                        internalType: "uint128",
                        name: "checkpointTs",
                        type: "uint128",
                    },
                    {
                        internalType: "uint128",
                        name: "writtenTs",
                        type: "uint128",
                    },
                    {
                        internalType: "int256[3]",
                        name: "coefficients",
                        type: "int256[3]",
                    },
                ],
                internalType: "struct IEscrowCurveTokenStorage.TokenPoint",
                name: "",
                type: "tuple",
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
        name: "tokenPointIntervals",
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
                name: "newImplementation",
                type: "address",
            },
        ],
        name: "upgradeTo",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "newImplementation",
                type: "address",
            },
            {
                internalType: "bytes",
                name: "data",
                type: "bytes",
            },
        ],
        name: "upgradeToAndCall",
        outputs: [],
        stateMutability: "payable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "_tokenId",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "_t",
                type: "uint256",
            },
        ],
        name: "votingPowerAt",
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
        name: "warmupPeriod",
        outputs: [
            {
                internalType: "uint48",
                name: "",
                type: "uint48",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
] as const;
