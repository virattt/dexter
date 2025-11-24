export const CFA_FORWARDER_ABI = [
    {
        inputs: [
            {
                internalType: "contract ISuperfluid",
                name: "host",
                type: "address",
            },
        ],
        stateMutability: "nonpayable",
        type: "constructor",
    },
    { inputs: [], name: "CFA_FWD_INVALID_FLOW_RATE", type: "error" },
    {
        inputs: [
            {
                internalType: "contract ISuperToken",
                name: "token",
                type: "address",
            },
            { internalType: "address", name: "sender", type: "address" },
            { internalType: "address", name: "receiver", type: "address" },
            { internalType: "int96", name: "flowrate", type: "int96" },
            { internalType: "bytes", name: "userData", type: "bytes" },
        ],
        name: "createFlow",
        outputs: [{ internalType: "bool", name: "", type: "bool" }],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "contract ISuperToken",
                name: "token",
                type: "address",
            },
            { internalType: "address", name: "sender", type: "address" },
            { internalType: "address", name: "receiver", type: "address" },
            { internalType: "bytes", name: "userData", type: "bytes" },
        ],
        name: "deleteFlow",
        outputs: [{ internalType: "bool", name: "", type: "bool" }],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "contract ISuperToken",
                name: "token",
                type: "address",
            },
            { internalType: "address", name: "account", type: "address" },
        ],
        name: "getAccountFlowInfo",
        outputs: [
            { internalType: "uint256", name: "lastUpdated", type: "uint256" },
            { internalType: "int96", name: "flowrate", type: "int96" },
            { internalType: "uint256", name: "deposit", type: "uint256" },
            { internalType: "uint256", name: "owedDeposit", type: "uint256" },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "contract ISuperToken",
                name: "token",
                type: "address",
            },
            { internalType: "address", name: "account", type: "address" },
        ],
        name: "getAccountFlowrate",
        outputs: [{ internalType: "int96", name: "flowrate", type: "int96" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "contract ISuperToken",
                name: "token",
                type: "address",
            },
            { internalType: "int96", name: "flowrate", type: "int96" },
        ],
        name: "getBufferAmountByFlowrate",
        outputs: [{ internalType: "uint256", name: "bufferAmount", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "contract ISuperToken",
                name: "token",
                type: "address",
            },
            { internalType: "address", name: "sender", type: "address" },
            { internalType: "address", name: "receiver", type: "address" },
        ],
        name: "getFlowInfo",
        outputs: [
            { internalType: "uint256", name: "lastUpdated", type: "uint256" },
            { internalType: "int96", name: "flowrate", type: "int96" },
            { internalType: "uint256", name: "deposit", type: "uint256" },
            { internalType: "uint256", name: "owedDeposit", type: "uint256" },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "contract ISuperToken",
                name: "token",
                type: "address",
            },
            { internalType: "address", name: "sender", type: "address" },
            { internalType: "address", name: "flowOperator", type: "address" },
        ],
        name: "getFlowOperatorPermissions",
        outputs: [
            { internalType: "uint8", name: "permissions", type: "uint8" },
            { internalType: "int96", name: "flowrateAllowance", type: "int96" },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "contract ISuperToken",
                name: "token",
                type: "address",
            },
            { internalType: "address", name: "sender", type: "address" },
            { internalType: "address", name: "receiver", type: "address" },
        ],
        name: "getFlowrate",
        outputs: [{ internalType: "int96", name: "flowrate", type: "int96" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "contract ISuperToken",
                name: "token",
                type: "address",
            },
            { internalType: "address", name: "flowOperator", type: "address" },
        ],
        name: "grantPermissions",
        outputs: [{ internalType: "bool", name: "", type: "bool" }],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "contract ISuperToken",
                name: "token",
                type: "address",
            },
            { internalType: "address", name: "flowOperator", type: "address" },
        ],
        name: "revokePermissions",
        outputs: [{ internalType: "bool", name: "", type: "bool" }],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "contract ISuperToken",
                name: "token",
                type: "address",
            },
            { internalType: "address", name: "receiver", type: "address" },
            { internalType: "int96", name: "flowrate", type: "int96" },
        ],
        name: "setFlowrate",
        outputs: [{ internalType: "bool", name: "", type: "bool" }],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "contract ISuperToken",
                name: "token",
                type: "address",
            },
            { internalType: "address", name: "sender", type: "address" },
            { internalType: "address", name: "receiver", type: "address" },
            { internalType: "int96", name: "flowrate", type: "int96" },
        ],
        name: "setFlowrateFrom",
        outputs: [{ internalType: "bool", name: "", type: "bool" }],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "contract ISuperToken",
                name: "token",
                type: "address",
            },
            { internalType: "address", name: "sender", type: "address" },
            { internalType: "address", name: "receiver", type: "address" },
            { internalType: "int96", name: "flowrate", type: "int96" },
            { internalType: "bytes", name: "userData", type: "bytes" },
        ],
        name: "updateFlow",
        outputs: [{ internalType: "bool", name: "", type: "bool" }],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "contract ISuperToken",
                name: "token",
                type: "address",
            },
            { internalType: "address", name: "flowOperator", type: "address" },
            { internalType: "uint8", name: "permissions", type: "uint8" },
            { internalType: "int96", name: "flowrateAllowance", type: "int96" },
        ],
        name: "updateFlowOperatorPermissions",
        outputs: [{ internalType: "bool", name: "", type: "bool" }],
        stateMutability: "nonpayable",
        type: "function",
    },
] as const;

export const GDA_FORWARDER_ABI = [
    {
        inputs: [
            {
                internalType: "contract ISuperfluid",
                name: "host",
                type: "address",
            },
        ],
        stateMutability: "nonpayable",
        type: "constructor",
    },
    {
        inputs: [
            {
                internalType: "contract ISuperfluidPool",
                name: "pool",
                type: "address",
            },
            { internalType: "address", name: "memberAddress", type: "address" },
            { internalType: "bytes", name: "userData", type: "bytes" },
        ],
        name: "claimAll",
        outputs: [{ internalType: "bool", name: "success", type: "bool" }],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "contract ISuperfluidPool",
                name: "pool",
                type: "address",
            },
            { internalType: "bytes", name: "userData", type: "bytes" },
        ],
        name: "connectPool",
        outputs: [{ internalType: "bool", name: "", type: "bool" }],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "contract ISuperfluidToken",
                name: "token",
                type: "address",
            },
            { internalType: "address", name: "admin", type: "address" },
            {
                components: [
                    {
                        internalType: "bool",
                        name: "transferabilityForUnitsOwner",
                        type: "bool",
                    },
                    {
                        internalType: "bool",
                        name: "distributionFromAnyAddress",
                        type: "bool",
                    },
                ],
                internalType: "struct PoolConfig",
                name: "config",
                type: "tuple",
            },
        ],
        name: "createPool",
        outputs: [
            { internalType: "bool", name: "success", type: "bool" },
            {
                internalType: "contract ISuperfluidPool",
                name: "pool",
                type: "address",
            },
        ],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "contract ISuperfluidPool",
                name: "pool",
                type: "address",
            },
            { internalType: "bytes", name: "userData", type: "bytes" },
        ],
        name: "disconnectPool",
        outputs: [{ internalType: "bool", name: "", type: "bool" }],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "contract ISuperfluidToken",
                name: "token",
                type: "address",
            },
            { internalType: "address", name: "from", type: "address" },
            {
                internalType: "contract ISuperfluidPool",
                name: "pool",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "requestedAmount",
                type: "uint256",
            },
            { internalType: "bytes", name: "userData", type: "bytes" },
        ],
        name: "distribute",
        outputs: [{ internalType: "bool", name: "", type: "bool" }],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "contract ISuperfluidToken",
                name: "token",
                type: "address",
            },
            { internalType: "address", name: "from", type: "address" },
            {
                internalType: "contract ISuperfluidPool",
                name: "pool",
                type: "address",
            },
            { internalType: "int96", name: "requestedFlowRate", type: "int96" },
            { internalType: "bytes", name: "userData", type: "bytes" },
        ],
        name: "distributeFlow",
        outputs: [{ internalType: "bool", name: "", type: "bool" }],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "contract ISuperfluidToken",
                name: "token",
                type: "address",
            },
            { internalType: "address", name: "from", type: "address" },
            {
                internalType: "contract ISuperfluidPool",
                name: "to",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "requestedAmount",
                type: "uint256",
            },
        ],
        name: "estimateDistributionActualAmount",
        outputs: [{ internalType: "uint256", name: "actualAmount", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "contract ISuperfluidToken",
                name: "token",
                type: "address",
            },
            { internalType: "address", name: "from", type: "address" },
            {
                internalType: "contract ISuperfluidPool",
                name: "to",
                type: "address",
            },
            { internalType: "int96", name: "requestedFlowRate", type: "int96" },
        ],
        name: "estimateFlowDistributionActualFlowRate",
        outputs: [
            { internalType: "int96", name: "actualFlowRate", type: "int96" },
            {
                internalType: "int96",
                name: "totalDistributionFlowRate",
                type: "int96",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "contract ISuperfluidToken",
                name: "token",
                type: "address",
            },
            { internalType: "address", name: "from", type: "address" },
            {
                internalType: "contract ISuperfluidPool",
                name: "to",
                type: "address",
            },
        ],
        name: "getFlowDistributionFlowRate",
        outputs: [{ internalType: "int96", name: "", type: "int96" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "contract ISuperfluidToken",
                name: "token",
                type: "address",
            },
            { internalType: "address", name: "account", type: "address" },
        ],
        name: "getNetFlow",
        outputs: [{ internalType: "int96", name: "", type: "int96" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "contract ISuperfluidPool",
                name: "pool",
                type: "address",
            },
        ],
        name: "getPoolAdjustmentFlowInfo",
        outputs: [
            { internalType: "address", name: "", type: "address" },
            { internalType: "bytes32", name: "", type: "bytes32" },
            { internalType: "int96", name: "", type: "int96" },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [{ internalType: "address", name: "pool", type: "address" }],
        name: "getPoolAdjustmentFlowRate",
        outputs: [{ internalType: "int96", name: "", type: "int96" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "contract ISuperfluidPool",
                name: "pool",
                type: "address",
            },
            { internalType: "address", name: "member", type: "address" },
        ],
        name: "isMemberConnected",
        outputs: [{ internalType: "bool", name: "", type: "bool" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "contract ISuperfluidToken",
                name: "token",
                type: "address",
            },
            { internalType: "address", name: "account", type: "address" },
        ],
        name: "isPool",
        outputs: [{ internalType: "bool", name: "", type: "bool" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "contract ISuperfluidPool",
                name: "pool",
                type: "address",
            },
            { internalType: "address", name: "memberAddress", type: "address" },
            { internalType: "uint128", name: "newUnits", type: "uint128" },
            { internalType: "bytes", name: "userData", type: "bytes" },
        ],
        name: "updateMemberUnits",
        outputs: [{ internalType: "bool", name: "success", type: "bool" }],
        stateMutability: "nonpayable",
        type: "function",
    },
] as const;

export const POOL_ABI = [
    {
        inputs: [],
        name: "SUPERFLUID_POOL_INVALID_TIME",
        type: "error",
    },
    {
        inputs: [],
        name: "SUPERFLUID_POOL_NOT_GDA",
        type: "error",
    },
    {
        inputs: [],
        name: "SUPERFLUID_POOL_NOT_POOL_ADMIN_OR_GDA",
        type: "error",
    },
    {
        inputs: [],
        name: "SUPERFLUID_POOL_NO_POOL_MEMBERS",
        type: "error",
    },
    {
        inputs: [],
        name: "SUPERFLUID_POOL_NO_ZERO_ADDRESS",
        type: "error",
    },
    {
        inputs: [],
        name: "SUPERFLUID_POOL_SELF_TRANSFER_NOT_ALLOWED",
        type: "error",
    },
    {
        inputs: [],
        name: "SUPERFLUID_POOL_TRANSFER_UNITS_NOT_ALLOWED",
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
                internalType: "address",
                name: "spender",
                type: "address",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "value",
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
                indexed: true,
                internalType: "contract ISuperfluidToken",
                name: "token",
                type: "address",
            },
            {
                indexed: true,
                internalType: "address",
                name: "member",
                type: "address",
            },
            {
                indexed: false,
                internalType: "int256",
                name: "claimedAmount",
                type: "int256",
            },
            {
                indexed: false,
                internalType: "int256",
                name: "totalClaimed",
                type: "int256",
            },
        ],
        name: "DistributionClaimed",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "contract ISuperfluidToken",
                name: "token",
                type: "address",
            },
            {
                indexed: true,
                internalType: "address",
                name: "member",
                type: "address",
            },
            {
                indexed: false,
                internalType: "uint128",
                name: "oldUnits",
                type: "uint128",
            },
            {
                indexed: false,
                internalType: "uint128",
                name: "newUnits",
                type: "uint128",
            },
        ],
        name: "MemberUnitsUpdated",
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
                name: "value",
                type: "uint256",
            },
        ],
        name: "Transfer",
        type: "event",
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
        inputs: [
            {
                internalType: "address",
                name: "owner",
                type: "address",
            },
            {
                internalType: "address",
                name: "spender",
                type: "address",
            },
        ],
        name: "allowance",
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
                name: "spender",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "value",
                type: "uint256",
            },
        ],
        name: "approve",
        outputs: [
            {
                internalType: "bool",
                name: "",
                type: "bool",
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
        name: "balanceOf",
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
                name: "memberAddr",
                type: "address",
            },
        ],
        name: "claimAll",
        outputs: [
            {
                internalType: "bool",
                name: "",
                type: "bool",
            },
        ],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [],
        name: "claimAll",
        outputs: [
            {
                internalType: "bool",
                name: "",
                type: "bool",
            },
        ],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "spender",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "subtractedValue",
                type: "uint256",
            },
        ],
        name: "decreaseAllowance",
        outputs: [
            {
                internalType: "bool",
                name: "",
                type: "bool",
            },
        ],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [],
        name: "distributionFromAnyAddress",
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
                name: "memberAddr",
                type: "address",
            },
            {
                internalType: "uint32",
                name: "time",
                type: "uint32",
            },
        ],
        name: "getClaimable",
        outputs: [
            {
                internalType: "int256",
                name: "",
                type: "int256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "memberAddr",
                type: "address",
            },
        ],
        name: "getClaimableNow",
        outputs: [
            {
                internalType: "int256",
                name: "claimableBalance",
                type: "int256",
            },
            {
                internalType: "uint256",
                name: "timestamp",
                type: "uint256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint32",
                name: "time",
                type: "uint32",
            },
        ],
        name: "getDisconnectedBalance",
        outputs: [
            {
                internalType: "int256",
                name: "balance",
                type: "int256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "memberAddr",
                type: "address",
            },
        ],
        name: "getMemberFlowRate",
        outputs: [
            {
                internalType: "int96",
                name: "",
                type: "int96",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "memberAddr",
                type: "address",
            },
        ],
        name: "getTotalAmountReceivedByMember",
        outputs: [
            {
                internalType: "uint256",
                name: "totalAmountReceived",
                type: "uint256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "getTotalConnectedFlowRate",
        outputs: [
            {
                internalType: "int96",
                name: "",
                type: "int96",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "getTotalConnectedUnits",
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
        name: "getTotalDisconnectedFlowRate",
        outputs: [
            {
                internalType: "int96",
                name: "",
                type: "int96",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "getTotalDisconnectedUnits",
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
        name: "getTotalFlowRate",
        outputs: [
            {
                internalType: "int96",
                name: "",
                type: "int96",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "getTotalUnits",
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
                name: "memberAddr",
                type: "address",
            },
        ],
        name: "getUnits",
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
                name: "spender",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "addedValue",
                type: "uint256",
            },
        ],
        name: "increaseAllowance",
        outputs: [
            {
                internalType: "bool",
                name: "",
                type: "bool",
            },
        ],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [],
        name: "superToken",
        outputs: [
            {
                internalType: "contract ISuperfluidToken",
                name: "",
                type: "address",
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
        inputs: [
            {
                internalType: "address",
                name: "to",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "value",
                type: "uint256",
            },
        ],
        name: "transfer",
        outputs: [
            {
                internalType: "bool",
                name: "",
                type: "bool",
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
                internalType: "address",
                name: "to",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "value",
                type: "uint256",
            },
        ],
        name: "transferFrom",
        outputs: [
            {
                internalType: "bool",
                name: "",
                type: "bool",
            },
        ],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [],
        name: "transferabilityForUnitsOwner",
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
                name: "memberAddr",
                type: "address",
            },
            {
                internalType: "uint128",
                name: "newUnits",
                type: "uint128",
            },
        ],
        name: "updateMemberUnits",
        outputs: [
            {
                internalType: "bool",
                name: "",
                type: "bool",
            },
        ],
        stateMutability: "nonpayable",
        type: "function",
    },
] as const;

export const SUPER_TOKEN_FACTORY_ABI = [
    {
        inputs: [
            {
                internalType: "contract ISuperfluid",
                name: "host",
                type: "address",
            },
            {
                internalType: "contract ISuperToken",
                name: "superTokenLogic",
                type: "address",
            },
            {
                internalType: "contract IConstantOutflowNFT",
                name: "constantOutflowNFTLogic",
                type: "address",
            },
            {
                internalType: "contract IConstantInflowNFT",
                name: "constantInflowNFTLogic",
                type: "address",
            },
            {
                internalType: "contract IPoolAdminNFT",
                name: "poolAdminNFTLogic",
                type: "address",
            },
            {
                internalType: "contract IPoolMemberNFT",
                name: "poolMemberNFTLogic",
                type: "address",
            },
        ],
        stateMutability: "nonpayable",
        type: "constructor",
    },
    { inputs: [], name: "SUPER_TOKEN_FACTORY_ALREADY_EXISTS", type: "error" },
    { inputs: [], name: "SUPER_TOKEN_FACTORY_DOES_NOT_EXIST", type: "error" },
    {
        inputs: [],
        name: "SUPER_TOKEN_FACTORY_NON_UPGRADEABLE_IS_DEPRECATED",
        type: "error",
    },
    {
        inputs: [],
        name: "SUPER_TOKEN_FACTORY_ONLY_GOVERNANCE_OWNER",
        type: "error",
    },
    { inputs: [], name: "SUPER_TOKEN_FACTORY_ONLY_HOST", type: "error" },
    { inputs: [], name: "SUPER_TOKEN_FACTORY_UNINITIALIZED", type: "error" },
    { inputs: [], name: "SUPER_TOKEN_FACTORY_ZERO_ADDRESS", type: "error" },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "bytes32",
                name: "uuid",
                type: "bytes32",
            },
            {
                indexed: false,
                internalType: "address",
                name: "codeAddress",
                type: "address",
            },
        ],
        name: "CodeUpdated",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "contract ISuperToken",
                name: "token",
                type: "address",
            },
        ],
        name: "CustomSuperTokenCreated",
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
                internalType: "contract ISuperToken",
                name: "token",
                type: "address",
            },
        ],
        name: "SuperTokenCreated",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "contract ISuperToken",
                name: "tokenLogic",
                type: "address",
            },
        ],
        name: "SuperTokenLogicCreated",
        type: "event",
    },
    {
        inputs: [],
        name: "CONSTANT_INFLOW_NFT_LOGIC",
        outputs: [
            {
                internalType: "contract IConstantInflowNFT",
                name: "",
                type: "address",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "CONSTANT_OUTFLOW_NFT_LOGIC",
        outputs: [
            {
                internalType: "contract IConstantOutflowNFT",
                name: "",
                type: "address",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "POOL_ADMIN_NFT_LOGIC",
        outputs: [
            {
                internalType: "contract IPoolAdminNFT",
                name: "",
                type: "address",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "POOL_MEMBER_NFT_LOGIC",
        outputs: [
            {
                internalType: "contract IPoolMemberNFT",
                name: "",
                type: "address",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "_SUPER_TOKEN_LOGIC",
        outputs: [{ internalType: "contract ISuperToken", name: "", type: "address" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "castrate",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "_underlyingToken",
                type: "address",
            },
        ],
        name: "computeCanonicalERC20WrapperAddress",
        outputs: [
            {
                internalType: "address",
                name: "superTokenAddress",
                type: "address",
            },
            { internalType: "bool", name: "isDeployed", type: "bool" },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "contract IERC20Metadata",
                name: "_underlyingToken",
                type: "address",
            },
        ],
        name: "createCanonicalERC20Wrapper",
        outputs: [{ internalType: "contract ISuperToken", name: "", type: "address" }],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "contract IERC20Metadata",
                name: "underlyingToken",
                type: "address",
            },
            {
                internalType: "enum ISuperTokenFactory.Upgradability",
                name: "upgradability",
                type: "uint8",
            },
            { internalType: "string", name: "name", type: "string" },
            { internalType: "string", name: "symbol", type: "string" },
        ],
        name: "createERC20Wrapper",
        outputs: [
            {
                internalType: "contract ISuperToken",
                name: "superToken",
                type: "address",
            },
        ],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "contract IERC20Metadata",
                name: "underlyingToken",
                type: "address",
            },
            {
                internalType: "enum ISuperTokenFactory.Upgradability",
                name: "upgradability",
                type: "uint8",
            },
            { internalType: "string", name: "name", type: "string" },
            { internalType: "string", name: "symbol", type: "string" },
            { internalType: "address", name: "admin", type: "address" },
        ],
        name: "createERC20Wrapper",
        outputs: [
            {
                internalType: "contract ISuperToken",
                name: "superToken",
                type: "address",
            },
        ],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "contract IERC20Metadata",
                name: "underlyingToken",
                type: "address",
            },
            {
                internalType: "uint8",
                name: "underlyingDecimals",
                type: "uint8",
            },
            {
                internalType: "enum ISuperTokenFactory.Upgradability",
                name: "upgradability",
                type: "uint8",
            },
            { internalType: "string", name: "name", type: "string" },
            { internalType: "string", name: "symbol", type: "string" },
        ],
        name: "createERC20Wrapper",
        outputs: [
            {
                internalType: "contract ISuperToken",
                name: "superToken",
                type: "address",
            },
        ],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "contract IERC20Metadata",
                name: "underlyingToken",
                type: "address",
            },
            {
                internalType: "uint8",
                name: "underlyingDecimals",
                type: "uint8",
            },
            {
                internalType: "enum ISuperTokenFactory.Upgradability",
                name: "upgradability",
                type: "uint8",
            },
            { internalType: "string", name: "name", type: "string" },
            { internalType: "string", name: "symbol", type: "string" },
            { internalType: "address", name: "admin", type: "address" },
        ],
        name: "createERC20Wrapper",
        outputs: [
            {
                internalType: "contract ISuperToken",
                name: "superToken",
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
                name: "_underlyingTokenAddress",
                type: "address",
            },
        ],
        name: "getCanonicalERC20Wrapper",
        outputs: [
            {
                internalType: "address",
                name: "superTokenAddress",
                type: "address",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "getCodeAddress",
        outputs: [{ internalType: "address", name: "codeAddress", type: "address" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "getHost",
        outputs: [{ internalType: "address", name: "host", type: "address" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "getSuperTokenLogic",
        outputs: [{ internalType: "contract ISuperToken", name: "", type: "address" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "initialize",
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
                        name: "underlyingToken",
                        type: "address",
                    },
                    {
                        internalType: "address",
                        name: "superToken",
                        type: "address",
                    },
                ],
                internalType: "struct SuperTokenFactoryBase.InitializeData[]",
                name: "_data",
                type: "tuple[]",
            },
        ],
        name: "initializeCanonicalWrapperSuperTokens",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "customSuperTokenProxy",
                type: "address",
            },
        ],
        name: "initializeCustomSuperToken",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [],
        name: "proxiableUUID",
        outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
        stateMutability: "pure",
        type: "function",
    },
    {
        inputs: [{ internalType: "address", name: "newAddress", type: "address" }],
        name: "updateCode",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
] as const;
