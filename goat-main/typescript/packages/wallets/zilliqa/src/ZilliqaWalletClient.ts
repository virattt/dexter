//import { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { Balance, Chain, Signature, WalletClientBase } from "@goat-sdk/core";
import { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { ViemEVMWalletClient } from "@goat-sdk/wallet-viem";
import { ViemOptions } from "@goat-sdk/wallet-viem";
import { Account } from "@zilliqa-js/account";
import { Zilliqa } from "@zilliqa-js/zilliqa";
import { type WalletClient as ViemWalletClient } from "viem";

export abstract class ZilliqaWalletClient extends WalletClientBase {
    abstract getZilliqaChainId(): number;

    // This is as close as we're going to get to an abstract interface for the moment;
    // when we add browser wallets, we will have to change this, but I'm reluctant
    // to invent yet another Zilliqa-native transaction abstraction before we have to.
    abstract getZilliqa(): Zilliqa;

    abstract getEVM(): EVMWalletClient;
}

// Zilliqa has two APIs - EVM and native. The native API is provided by the Zilliqa object. For the EVM API,
// we thunk down to viem.
//
// We need to encapsulate, rather than extend ViemEVMWalletClient so that we can report our chain type correctly.
// One day it would be nice to add the ability to use ZilPay client integration, but those libraries don't exist yet,
// so we do this instead.
export class ZilliqaJSViemWalletClient extends ZilliqaWalletClient {
    zilliqa: Zilliqa;
    viem: ViemEVMWalletClient;
    // This was originally a static assignment; however, this causes
    // typescript to emit invalid JS when compiling the CJS version of
    // the distribution package, so it is now initialized in the
    // constructor.
    chainId;

    constructor(client: ViemWalletClient, node: string, account: Account, chainId: number, options?: ViemOptions) {
        super();
        this.chainId = 0;
        this.viem = new ViemEVMWalletClient(client, options);
        this.zilliqa = new Zilliqa(node);
        this.zilliqa.wallet.addByPrivateKey(account.privateKey);
        this.chainId = chainId;
    }

    getZilliqaChainId(): number {
        return this.chainId;
    }

    // Use the EVM address here - callers expecting the Zilliqa address will hopefully know
    // to get an address from getZilliqa() instead.
    getAddress(): string {
        return this.viem.getAddress();
    }

    // We have to return "evm" here because that is what getChain()
    // requires and it is necessary to enable plugins that expect us
    // to be evm.
    override getChain(): Chain {
        return {
            type: "zilliqa" as const,
            id: this.chainId,
            evmId: this.chainId | 0x8000,
        };
    }

    signMessage(message: string): Promise<Signature> {
        return this.viem.signMessage(message);
    }

    balanceOf(address: string): Promise<Balance> {
        return this.viem.balanceOf(address);
    }

    getEVM(): EVMWalletClient {
        return this.viem;
    }

    getZilliqa(): Zilliqa {
        return this.zilliqa;
    }
}

// This is separate because it requires an RPC call and is thus async.
export async function zilliqaChainId(node: string) {
    const tempZil = new Zilliqa(node);
    return Number.parseInt((await tempZil.network.GetNetworkId())?.result);
}

export function zilliqaJSViemWalletClient(
    client: ViemWalletClient,
    node: string,
    account: Account,
    chainId: number,
    options?: ViemOptions,
): ZilliqaWalletClient {
    return new ZilliqaJSViemWalletClient(client, node, account, chainId, options);
}
