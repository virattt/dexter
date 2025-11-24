import { WalletClientBase } from "@goat-sdk/core";
import { formatUnits } from "ethers";
import type { Call, InvocationsDetails, RpcProvider } from "starknet";

export type StarknetWalletCtorParams = {
    starknetClient: RpcProvider;
};

export type StarknetTransaction = {
    calls: Call[];
    transactionDetails?: InvocationsDetails;
};

export abstract class StarknetWalletClient extends WalletClientBase {
    protected starknetClient: RpcProvider;

    constructor(params: StarknetWalletCtorParams) {
        super();
        this.starknetClient = params.starknetClient;
    }

    getChain() {
        return {
            type: "starknet",
        } as const;
    }

    getClient() {
        return this.starknetClient;
    }

    abstract getAddress(): string;

    abstract signMessage(message: string): Promise<{ signature: string }>;

    abstract sendTransaction(transaction: StarknetTransaction): Promise<{ hash: string }>;

    async balanceOf(address: string) {
        try {
            const ETH_CONTRACT = "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7";

            const result = await this.starknetClient.callContract({
                contractAddress: ETH_CONTRACT,
                entrypoint: "balanceOf",
                calldata: [address],
            });

            const balanceWei = result[0];

            return {
                decimals: 18,
                symbol: "ETH",
                name: "Ethereum",
                value: formatUnits(balanceWei, 18),
                inBaseUnits: balanceWei.toString(),
            };
        } catch (error) {
            throw new Error(`Error fetching balance: ${error}`);
        }
    }
}
