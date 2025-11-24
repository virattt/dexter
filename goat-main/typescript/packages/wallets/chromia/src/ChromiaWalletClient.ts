import { type Connection, type KeyStoreInteractor, createAmount } from "@chromia/ft4";
import { WalletClientBase } from "@goat-sdk/core";
import type { DictPair, IClient, QueryObject, RawGtv } from "postchain-client";
import { formatUnits } from "viem";
import type { ChromiaTransaction } from "./types/ChromiaTransaction";

export type ChromiaWalletCtorParams = {
    client: IClient;
    keystoreInteractor: KeyStoreInteractor;
    accountAddress: string;
    assetId: string;
    connection: Connection;
};

export class ChromiaWalletClient extends WalletClientBase {
    public readonly networkName: string; // Store "mainnet" or "testnet"

    constructor(public readonly params: ChromiaWalletCtorParams) {
        super();

        // Mapping directoryChainRid to network names
        const DIRECTORY_CHAIN_BRIDS: Record<string, string> = {
            "7E5BE539EF62E48DDA7035867E67734A70833A69D2F162C457282C319AA58AE4": "mainnet",
            "6F1B061C633A992BF195850BF5AA1B6F887AEE01BB3F51251C230930FB792A92": "testnet",
        };

        const directoryChainRid = params.client.config.directoryChainRid;
        const network = DIRECTORY_CHAIN_BRIDS[directoryChainRid];

        if (!network) {
            throw new Error(
                `Unknown directoryChainRid: ${directoryChainRid}. Ensure the client is configured correctly.`,
            );
        }

        this.networkName = network; // Save network name for use in explorer links
    }

    getAddress(): string {
        return this.params.accountAddress;
    }

    getChain() {
        return { type: "chromia" } as const;
    }

    async signMessage(message: string) {
        // TODO: Implement keystore signing
        return { signature: "" };
    }

    async sendTransaction({ to, amount }: ChromiaTransaction) {
        if (!to.match(/^[a-f0-9]{64}$/i)) {
            throw new Error("Invalid Address");
        }

        const { keystoreInteractor, connection, assetId } = this.params;
        const accounts = await keystoreInteractor.getAccounts();
        const session = await keystoreInteractor.getSession(accounts[0].id);
        const asset = await connection.getAssetById(assetId);
        if (!asset) {
            throw new Error(`Asset ${assetId} not found on Blockchain RID: ${connection.blockchainRid}`);
        }

        const amountToSend = createAmount(amount, asset.decimals);
        return await session.account.transfer(to, assetId, amountToSend);
    }

    async read(nameOrQueryObject: string | QueryObject<RawGtv | DictPair>) {
        return this.params.client.query(nameOrQueryObject);
    }

    async balanceOf(address: string) {
        const { connection, assetId } = this.params;
        const account = await connection.getAccountById(address);
        if (account) {
            const balance = await account.getBalanceByAssetId(assetId);
            if (balance) {
                return {
                    decimals: balance.asset.decimals,
                    symbol: balance.asset.symbol,
                    name: balance.asset.name,
                    value: formatUnits(BigInt(balance.amount.value), balance.asset.decimals),
                    inBaseUnits: balance.amount.value.toString(),
                };
            }
        }

        const asset = await connection.getAssetById(assetId);
        if (!asset) {
            throw new Error(`Asset ${assetId} not found on Blockchain RID: ${connection.blockchainRid}`);
        }

        return {
            decimals: asset.decimals,
            symbol: asset.symbol,
            name: asset.name,
            value: "0",
            inBaseUnits: "0",
        };
    }
}

export const chromia = (params: ChromiaWalletCtorParams) => {
    return new ChromiaWalletClient(params);
};
