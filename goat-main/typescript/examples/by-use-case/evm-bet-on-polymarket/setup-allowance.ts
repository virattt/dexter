import dotenv from "dotenv";

dotenv.config();

import { viem } from "@goat-sdk/wallet-viem";
import { createWalletClient } from "viem";
import { http } from "viem";
import { parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygon } from "viem/chains";

export const ERC20_ABI = parseAbi([
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
]);

const ERC1155_ABI = parseAbi([
    "function isApprovedForAll(address owner, address operator) external view returns (bool)",
    "function setApprovalForAll(address operator, bool approved) external",
]);

const MAX_ALLOWANCE = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

// Define the contract configurations
type ContractConfig = {
    exchange: `0x${string}`;
    negRiskAdapter: `0x${string}`;
    negRiskExchange: `0x${string}`;
    usdc: `0x${string}`;
    ctf: `0x${string}`;
};

// Contract addresses for polygon (MATIC)
const POLYGON_CONTRACTS: ContractConfig = {
    exchange: "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E",
    negRiskAdapter: "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296",
    negRiskExchange: "0xC5d563A36AE78145C45a50134d48A1215220f80a",
    usdc: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    ctf: "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045",
};

// Initialize the wallet client
const account = privateKeyToAccount(process.env.WALLET_PRIVATE_KEY as `0x${string}`);

const chain = polygon;

const walletClient = createWalletClient({
    account: account,
    transport: http(process.env.ALCHEMY_API_URL as string),
    chain: chain,
});

const wallet = viem(walletClient);

(async () => {
    try {
        const contractConfig = POLYGON_CONTRACTS;
        const walletAddress = wallet.getAddress();

        const addressesToApprove = [
            contractConfig.exchange,
            contractConfig.negRiskExchange,
            contractConfig.negRiskAdapter,
        ];

        for (const address of addressesToApprove) {
            try {
                // Check allowance for USDC
                const { value } = await wallet.read({
                    address: contractConfig.usdc,
                    abi: ERC20_ABI,
                    functionName: "allowance",
                    args: [walletAddress, address],
                });

                if (value === 0n) {
                    console.log(`Approving USDC for ${address}`);
                    // Approve USDC
                    const { hash: usdcApproveHash } = await wallet.sendTransaction({
                        to: contractConfig.usdc,
                        abi: ERC20_ABI,
                        functionName: "approve",
                        args: [address, MAX_ALLOWANCE],
                    });
                    console.log(`Approved USDC for ${address}: ${usdcApproveHash}`);
                } else {
                    console.log(`USDC already approved for ${address}`);
                }
            } catch (error) {
                console.error(`Error approving USDC for ${address}:`, error);
            }

            try {
                // Check allowance for CTF
                const { value: isApprovedForAll } = (await wallet.read({
                    address: contractConfig.ctf,
                    abi: ERC1155_ABI,
                    functionName: "isApprovedForAll",
                    args: [walletAddress, address],
                })) as { value: bigint };

                if (!isApprovedForAll) {
                    console.log(`Approving CTF for ${address}`);
                    // Approve CTF
                    const { hash: ctfApproveHash } = await wallet.sendTransaction({
                        to: contractConfig.ctf,
                        abi: ERC1155_ABI,
                        functionName: "setApprovalForAll",
                        args: [address, true],
                    });

                    console.log(`Approved CTF for ${address}: ${ctfApproveHash}`);
                } else {
                    console.log(`CTF already approved for ${address}`);
                }
            } catch (error) {
                console.error(`Error approving CTF for ${address}:`, error);
            }
        }
    } catch (error) {
        console.error("An error occurred:", error);
    }
})();
