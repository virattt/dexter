const MODESPRAY_ABI = [
    {
        inputs: [
            { internalType: "address[]", name: "recipients", type: "address[]" },
            { internalType: "uint256[]", name: "values", type: "uint256[]" },
        ],
        name: "disperseEther",
        outputs: [],
        stateMutability: "payable",
        type: "function",
    },
    {
        inputs: [
            { internalType: "address", name: "token", type: "address" },
            { internalType: "address[]", name: "recipients", type: "address[]" },
            { internalType: "uint256[]", name: "values", type: "uint256[]" },
        ],
        name: "disperseToken",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
] as const;

const CONTRACT_ADDRESSES = {
    // Mode Mainnet (id: 919)
    919: "0xDBA7D42BAC31Fa58A6Ab7ffE95D9FfA4bD398A0f",
    // Mode Testnet (id: 34443)
    34443: "0x669Fa5586E6508dFde75a1a7CDe89f44D32d8A2A",
    // Base Sepolia
    84532: "0x70E7BdDAa87512121f969e55d432bE40973eA3E8",
    // Base Mainnet
    8453: "0x8EbA7AD6A31df00D399E540356d3Ca4b27950124",
    // Optimism Sepolia
    11155420: "0x8EbA7AD6A31df00D399E540356d3Ca4b27950124",
    // Optimism Mainnet
    10: "0x3A4e09Fd6F3B33A84eeFa66FC222D6dD7185eBeC",
} as const;

export const SPRAY_CONTRACTS_ABI = Object.entries(CONTRACT_ADDRESSES).reduce(
    (acc, [chainId, address]) => {
        const chainIdKey = Number(chainId) as keyof typeof CONTRACT_ADDRESSES;
        acc[chainIdKey] = {
            ModeSpray: {
                address,
                abi: MODESPRAY_ABI,
            },
        };
        return acc;
    },
    {} as Record<keyof typeof CONTRACT_ADDRESSES, { ModeSpray: { address: string; abi: typeof MODESPRAY_ABI } }>,
);

export function getSprayContract(chainId: number) {
    return SPRAY_CONTRACTS_ABI[chainId as keyof typeof CONTRACT_ADDRESSES]?.ModeSpray;
}
