export const RENZO_ABI = [
    {
        inputs: [],
        stateMutability: "nonpayable",
        type: "constructor",
    },
    {
        inputs: [],
        name: "InsufficientOutputAmount",
        type: "error",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "bridgeFee",
                type: "uint256",
            },
        ],
        name: "InvalidBridgeFeeShare",
        type: "error",
    },
    {
        inputs: [],
        name: "InvalidOraclePrice",
        type: "error",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "expectedSender",
                type: "address",
            },
            {
                internalType: "address",
                name: "actualSender",
                type: "address",
            },
        ],
        name: "InvalidSender",
        type: "error",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "batchSize",
                type: "uint256",
            },
        ],
        name: "InvalidSweepBatchSize",
        type: "error",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "timestamp",
                type: "uint256",
            },
        ],
        name: "InvalidTimestamp",
        type: "error",
    },
    {
        inputs: [
            {
                internalType: "uint8",
                name: "expected",
                type: "uint8",
            },
            {
                internalType: "uint8",
                name: "actual",
                type: "uint8",
            },
        ],
        name: "InvalidTokenDecimals",
        type: "error",
    },
    {
        inputs: [],
        name: "InvalidZeroInput",
        type: "error",
    },
    {
        inputs: [],
        name: "InvalidZeroOutput",
        type: "error",
    },
    {
        inputs: [],
        name: "OraclePriceExpired",
        type: "error",
    },
    {
        inputs: [],
        name: "PriceFeedNotAvailable",
        type: "error",
    },
    {
        inputs: [],
        name: "TransferFailed",
        type: "error",
    },
    {
        inputs: [],
        name: "UnauthorizedBridgeSweeper",
        type: "error",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "uint256",
                name: "oldBridgeFeeShare",
                type: "uint256",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "newBridgeFeeShare",
                type: "uint256",
            },
        ],
        name: "BridgeFeeShareUpdated",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "address",
                name: "sweeper",
                type: "address",
            },
            {
                indexed: false,
                internalType: "bool",
                name: "allowed",
                type: "bool",
            },
        ],
        name: "BridgeSweeperAddressUpdated",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "uint32",
                name: "destinationDomain",
                type: "uint32",
            },
            {
                indexed: false,
                internalType: "address",
                name: "destinationTarget",
                type: "address",
            },
            {
                indexed: false,
                internalType: "address",
                name: "delegate",
                type: "address",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "amount",
                type: "uint256",
            },
        ],
        name: "BridgeSwept",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "address",
                name: "user",
                type: "address",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "amountIn",
                type: "uint256",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "amountOut",
                type: "uint256",
            },
        ],
        name: "Deposit",
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
                internalType: "uint256",
                name: "price",
                type: "uint256",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "timestamp",
                type: "uint256",
            },
        ],
        name: "PriceUpdated",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "address",
                name: "newReceiver",
                type: "address",
            },
            {
                indexed: false,
                internalType: "address",
                name: "oldReceiver",
                type: "address",
            },
        ],
        name: "ReceiverPriceFeedUpdated",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "uint256",
                name: "oldSweepBatchSize",
                type: "uint256",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "newSweepBatchSize",
                type: "uint256",
            },
        ],
        name: "SweepBatchSizeUpdated",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "address",
                name: "sweeper",
                type: "address",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "feeCollected",
                type: "uint256",
            },
        ],
        name: "SweeperBridgeFeeCollected",
        type: "event",
    },
    {
        inputs: [],
        name: "EXPECTED_DECIMALS",
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
        name: "FEE_BASIS",
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
                internalType: "address",
                name: "",
                type: "address",
            },
        ],
        name: "allowedBridgeSweepers",
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
        name: "bridgeDestinationDomain",
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
        name: "bridgeFeeCollected",
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
        name: "bridgeFeeShare",
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
        name: "bridgeRouterFeeBps",
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
        name: "bridgeTargetAddress",
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
        name: "collateralToken",
        outputs: [
            {
                internalType: "contract IERC20",
                name: "",
                type: "address",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "connext",
        outputs: [
            {
                internalType: "contract IConnext",
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
                name: "_amountIn",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "_minOut",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "_deadline",
                type: "uint256",
            },
        ],
        name: "deposit",
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
                name: "_minOut",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "_deadline",
                type: "uint256",
            },
        ],
        name: "depositETH",
        outputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        stateMutability: "payable",
        type: "function",
    },
    {
        inputs: [],
        name: "depositToken",
        outputs: [
            {
                internalType: "contract IERC20",
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
                name: "_amountIn",
                type: "uint256",
            },
        ],
        name: "getBridgeFeeShare",
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
        name: "getMintRate",
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
        name: "getRate",
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
                name: "_currentPrice",
                type: "uint256",
            },
            {
                internalType: "contract IERC20",
                name: "_xezETH",
                type: "address",
            },
            {
                internalType: "contract IERC20",
                name: "_depositToken",
                type: "address",
            },
            {
                internalType: "contract IERC20",
                name: "_collateralToken",
                type: "address",
            },
            {
                internalType: "contract IConnext",
                name: "_connext",
                type: "address",
            },
            {
                internalType: "bytes32",
                name: "_swapKey",
                type: "bytes32",
            },
            {
                internalType: "address",
                name: "_receiver",
                type: "address",
            },
            {
                internalType: "uint32",
                name: "_bridgeDestinationDomain",
                type: "uint32",
            },
            {
                internalType: "address",
                name: "_bridgeTargetAddress",
                type: "address",
            },
            {
                internalType: "contract IRenzoOracleL2",
                name: "_oracle",
                type: "address",
            },
        ],
        name: "initialize",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [],
        name: "lastPrice",
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
        name: "lastPriceTimestamp",
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
        name: "oracle",
        outputs: [
            {
                internalType: "contract IRenzoOracleL2",
                name: "",
                type: "address",
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
        name: "receiver",
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
                name: "_token",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "_amount",
                type: "uint256",
            },
            {
                internalType: "address",
                name: "_to",
                type: "address",
            },
        ],
        name: "recoverERC20",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "_amount",
                type: "uint256",
            },
            {
                internalType: "address",
                name: "_to",
                type: "address",
            },
        ],
        name: "recoverNative",
        outputs: [],
        stateMutability: "nonpayable",
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
                name: "_sweeper",
                type: "address",
            },
            {
                internalType: "bool",
                name: "_allowed",
                type: "bool",
            },
        ],
        name: "setAllowedBridgeSweeper",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "_receiver",
                type: "address",
            },
        ],
        name: "setReceiverPriceFeed",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [],
        name: "swapKey",
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
        inputs: [],
        name: "sweep",
        outputs: [],
        stateMutability: "payable",
        type: "function",
    },
    {
        inputs: [],
        name: "sweepBatchSize",
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
        inputs: [
            {
                internalType: "uint256",
                name: "_newShare",
                type: "uint256",
            },
        ],
        name: "updateBridgeFeeShare",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "_price",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "_timestamp",
                type: "uint256",
            },
        ],
        name: "updatePrice",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "price",
                type: "uint256",
            },
        ],
        name: "updatePriceByOwner",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "_newBatchSize",
                type: "uint256",
            },
        ],
        name: "updateSweepBatchSize",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [],
        name: "xezETH",
        outputs: [
            {
                internalType: "contract IERC20",
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
