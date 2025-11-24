import { Balance, Signature, WalletClientBase, ZilliqaChain } from "@goat-sdk/core";
import { ViemEVMWalletClient } from "@goat-sdk/wallet-viem";
import { type PublicClient as ViemPublicClient, type WalletClient as ViemWalletClient } from "viem";

export class ZilliqaWalletClientViemOnly extends WalletClientBase {
    private viemPublicClient: ViemPublicClient;
    private viemWalletClient: ViemWalletClient;
    private viemEvm: ViemEVMWalletClient;
    private chain: ZilliqaChain;

    private constructor(
        client: ViemPublicClient,
        wallet: ViemWalletClient,
        evmWallet: ViemEVMWalletClient,
        chain: ZilliqaChain,
    ) {
        super();
        this.viemPublicClient = client;
        this.viemWalletClient = wallet;
        this.viemEvm = evmWallet;
        this.chain = chain;
    }

    static async createClient(client: ViemPublicClient, wallet: ViemWalletClient) {
        const chainId = await wallet.getChainId();
        const chain = {
            type: "zilliqa" as const,
            id: chainId ^ 0x8000,
            evmId: chainId,
        };
        const evmWallet = new ViemEVMWalletClient(wallet);
        return new ZilliqaWalletClientViemOnly(client, wallet, evmWallet, chain);
    }

    getViemPublicClient(): ViemPublicClient {
        return this.viemPublicClient;
    }

    getViemWalletClient(): ViemWalletClient {
        return this.viemWalletClient;
    }

    override getAddress(): string {
        return this.viemEvm.getAddress();
    }

    override getChain(): ZilliqaChain {
        return this.chain;
    }

    override signMessage(message: string): Promise<Signature> {
        return this.viemEvm.signMessage(message);
    }

    override balanceOf(address: string): Promise<Balance> {
        return this.viemEvm.balanceOf(address);
    }
}
