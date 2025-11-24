export const GAUGE_VOTER_ABI = [
    {
        inputs: [],
        stateMutability: "nonpayable",
        type: "constructor",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "tokenId",
                type: "uint256",
            },
        ],
        name: "AlreadyVoted",
        type: "error",
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
        name: "DoubleVote",
        type: "error",
    },
    {
        inputs: [],
        name: "GaugeActivationUnchanged",
        type: "error",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "_pool",
                type: "address",
            },
        ],
        name: "GaugeDoesNotExist",
        type: "error",
    },
    {
        inputs: [],
        name: "GaugeExists",
        type: "error",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "_gauge",
                type: "address",
            },
        ],
        name: "GaugeInactive",
        type: "error",
    },
    {
        inputs: [],
        name: "NoVotes",
        type: "error",
    },
    {
        inputs: [],
        name: "NoVotingPower",
        type: "error",
    },
    {
        inputs: [],
        name: "NotApprovedOrOwner",
        type: "error",
    },
    {
        inputs: [],
        name: "NotCurrentlyVoting",
        type: "error",
    },
    {
        inputs: [],
        name: "VotingInactive",
        type: "error",
    },
    {
        inputs: [],
        name: "ZeroGauge",
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
                indexed: true,
                internalType: "address",
                name: "gauge",
                type: "address",
            },
        ],
        name: "GaugeActivated",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "address",
                name: "gauge",
                type: "address",
            },
            {
                indexed: true,
                internalType: "address",
                name: "creator",
                type: "address",
            },
            {
                indexed: false,
                internalType: "string",
                name: "metadataURI",
                type: "string",
            },
        ],
        name: "GaugeCreated",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "address",
                name: "gauge",
                type: "address",
            },
        ],
        name: "GaugeDeactivated",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "address",
                name: "gauge",
                type: "address",
            },
            {
                indexed: false,
                internalType: "string",
                name: "metadataURI",
                type: "string",
            },
        ],
        name: "GaugeMetadataUpdated",
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
                indexed: false,
                internalType: "address",
                name: "account",
                type: "address",
            },
        ],
        name: "Paused",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "address",
                name: "voter",
                type: "address",
            },
            {
                indexed: true,
                internalType: "address",
                name: "gauge",
                type: "address",
            },
            {
                indexed: true,
                internalType: "uint256",
                name: "epoch",
                type: "uint256",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "tokenId",
                type: "uint256",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "votingPowerRemovedFromGauge",
                type: "uint256",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "totalVotingPowerInGauge",
                type: "uint256",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "totalVotingPowerInContract",
                type: "uint256",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "timestamp",
                type: "uint256",
            },
        ],
        name: "Reset",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "address",
                name: "account",
                type: "address",
            },
        ],
        name: "Unpaused",
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
                indexed: true,
                internalType: "address",
                name: "voter",
                type: "address",
            },
            {
                indexed: true,
                internalType: "address",
                name: "gauge",
                type: "address",
            },
            {
                indexed: true,
                internalType: "uint256",
                name: "epoch",
                type: "uint256",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "tokenId",
                type: "uint256",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "votingPowerCastForGauge",
                type: "uint256",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "totalVotingPowerInGauge",
                type: "uint256",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "totalVotingPowerInContract",
                type: "uint256",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "timestamp",
                type: "uint256",
            },
        ],
        name: "Voted",
        type: "event",
    },
    {
        inputs: [],
        name: "GAUGE_ADMIN_ROLE",
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
        name: "UPGRADE_PLUGIN_PERMISSION_ID",
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
                internalType: "address",
                name: "_gauge",
                type: "address",
            },
        ],
        name: "activateGauge",
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
        inputs: [
            {
                internalType: "address",
                name: "_gauge",
                type: "address",
            },
            {
                internalType: "string",
                name: "_metadataURI",
                type: "string",
            },
        ],
        name: "createGauge",
        outputs: [
            {
                internalType: "address",
                name: "gauge",
                type: "address",
            },
        ],
        stateMutability: "nonpayable",
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
        inputs: [
            {
                internalType: "address",
                name: "_gauge",
                type: "address",
            },
        ],
        name: "deactivateGauge",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [],
        name: "epochId",
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
        name: "epochStart",
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
        name: "epochVoteEnd",
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
        name: "epochVoteStart",
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
                internalType: "address",
                name: "_gauge",
                type: "address",
            },
        ],
        name: "gaugeExists",
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
        name: "gaugeList",
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
        name: "gaugeVotes",
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
        name: "gauges",
        outputs: [
            {
                internalType: "bool",
                name: "active",
                type: "bool",
            },
            {
                internalType: "uint256",
                name: "created",
                type: "uint256",
            },
            {
                internalType: "string",
                name: "metadataURI",
                type: "string",
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
        ],
        name: "gaugesVotedFor",
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
        inputs: [],
        name: "getAllGauges",
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
                internalType: "address",
                name: "_gauge",
                type: "address",
            },
        ],
        name: "getGauge",
        outputs: [
            {
                components: [
                    {
                        internalType: "bool",
                        name: "active",
                        type: "bool",
                    },
                    {
                        internalType: "uint256",
                        name: "created",
                        type: "uint256",
                    },
                    {
                        internalType: "string",
                        name: "metadataURI",
                        type: "string",
                    },
                ],
                internalType: "struct IGauge.Gauge",
                name: "",
                type: "tuple",
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
        inputs: [
            {
                internalType: "address",
                name: "_dao",
                type: "address",
            },
            {
                internalType: "address",
                name: "_escrow",
                type: "address",
            },
            {
                internalType: "bool",
                name: "_startPaused",
                type: "bool",
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
                internalType: "address",
                name: "_gauge",
                type: "address",
            },
        ],
        name: "isActive",
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
        ],
        name: "isVoting",
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
        name: "pause",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [],
        name: "paused",
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
        name: "pluginType",
        outputs: [
            {
                internalType: "enum IPlugin.PluginType",
                name: "",
                type: "uint8",
            },
        ],
        stateMutability: "pure",
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
                internalType: "uint256",
                name: "_tokenId",
                type: "uint256",
            },
        ],
        name: "reset",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "bytes4",
                name: "_interfaceId",
                type: "bytes4",
            },
        ],
        name: "supportsInterface",
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
        name: "totalVotingPowerCast",
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
        name: "unpause",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "_gauge",
                type: "address",
            },
            {
                internalType: "string",
                name: "_metadataURI",
                type: "string",
            },
        ],
        name: "updateGaugeMetadata",
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
        ],
        name: "usedVotingPower",
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
                name: "_tokenId",
                type: "uint256",
            },
            {
                components: [
                    {
                        internalType: "uint256",
                        name: "weight",
                        type: "uint256",
                    },
                    {
                        internalType: "address",
                        name: "gauge",
                        type: "address",
                    },
                ],
                internalType: "struct IGaugeVote.GaugeVote[]",
                name: "_votes",
                type: "tuple[]",
            },
        ],
        name: "vote",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256[]",
                name: "_tokenIds",
                type: "uint256[]",
            },
            {
                components: [
                    {
                        internalType: "uint256",
                        name: "weight",
                        type: "uint256",
                    },
                    {
                        internalType: "address",
                        name: "gauge",
                        type: "address",
                    },
                ],
                internalType: "struct IGaugeVote.GaugeVote[]",
                name: "_votes",
                type: "tuple[]",
            },
        ],
        name: "voteMultiple",
        outputs: [],
        stateMutability: "nonpayable",
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
                internalType: "address",
                name: "_gauge",
                type: "address",
            },
        ],
        name: "votes",
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
        name: "votingActive",
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
] as const;
