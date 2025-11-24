import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { Ed25519 } from "@cosmjs/crypto";
import { AccountData } from "@cosmjs/proto-signing";
import { QueryClient } from "@cosmjs/stargate";
import { Tendermint34Client } from "@cosmjs/tendermint-rpc";
import { assets, chains } from "chain-registry";
import { ContractReadData, ContractWriteData, CosmosReadRequest, CosmosTransaction, CosmosWalletClient } from "./types";

export type CosmosWalletOptions = {
    client: SigningCosmWasmClient;
    account: AccountData;
};

export class CosmosClient extends CosmosWalletClient {
    account: AccountData;
    client: SigningCosmWasmClient;

    constructor(params: CosmosWalletOptions) {
        super();
        this.account = params.account;
        this.client = params.client;
    }

    getAddress() {
        return this.account.address ?? "";
    }

    getChain() {
        return { type: "cosmos" } as const;
    }

    async getChainId() {
        return await this.client.getChainId();
    }

    async signMessage(message: string) {
        const messageBytes = Buffer.from(message);
        const u8 = new TextEncoder().encode(process.env.WALLET_MNEMONICS as `0x${string}`);
        const keys = await Ed25519.makeKeypair(u8);
        const sig = await Ed25519.createSignature(messageBytes, keys);

        return {
            signature: Buffer.from(sig).toString("hex"),
        };
    }

    async sendTransaction({ message }: CosmosTransaction) {
        const id = await this.client.getChainId();

        const fe = chains.find((ch) => ch.chain_id === id)?.fees?.fee_tokens[0];

        if (!fe) throw new Error("network data is unavailable");

        const memo = "txn";
        let gas = await this.client.simulate(this.account.address, [message], memo);
        gas = gas * 4;
        let tk = fe?.high_gas_price ?? fe?.average_gas_price ?? fe?.low_gas_price ?? fe?.fixed_min_gas_price ?? 0;
        tk = tk === 0 ? 0.25 : tk;
        const fee = { amount: [{ denom: fe?.denom, amount: Math.round(tk * gas).toString() }], gas: gas.toString() };

        const result = await this.client.signAndBroadcast(this.account.address, [message], fee, memo);

        if (!result.transactionHash) throw new Error("transaction was incomplete");

        return {
            value: result,
        };
    }

    async contractWrite(transaction: ContractWriteData) {
        const { contractAdr, message } = transaction;
        const id = await this.client.getChainId();

        const fe = chains.find((ch) => ch.chain_id === id)?.fees?.fee_tokens[0];

        if (!fe) throw new Error("network data is unavailable");

        if (!contractAdr) throw new Error("Invalid Contarct Address");

        const memo = "txn";
        const gas = 400000;
        let tk = fe?.high_gas_price ?? fe?.average_gas_price ?? fe?.low_gas_price ?? fe?.fixed_min_gas_price ?? 0;
        tk = tk === 0 ? 0.25 : tk;
        const fee = { amount: [{ denom: fe?.denom, amount: Math.round(tk * gas).toString() }], gas: gas.toString() };
        const result = await this.client.execute(this.getAddress(), contractAdr, message, fee, memo);
        if (!result.transactionHash) throw new Error("transaction was incomplete");
        return {
            value: result,
        };
    }

    async read(requestdata: CosmosReadRequest) {
        const cometClient = await Tendermint34Client.connect(process.env.RPC_PROVIDER_URL as `0x${string}`);
        const cli = new QueryClient(cometClient);
        const result = await cli.queryAbci(requestdata.message.typeUrl, requestdata.message.value);
        cometClient.disconnect();
        return {
            value: result,
        };
    }

    async contractRead(request: ContractReadData) {
        const { contractAdr, message } = request;
        if (!contractAdr) throw new Error("Invalid Contarct Address");
        const result = await this.client.queryContractSmart(request.contractAdr, message);
        return {
            value: result,
        };
    }

    async balanceOf(address: string) {
        const ast = await this.getChainInfo();

        if (!ast.asset) throw new Error("Asset data is unavailable");
        const _ast = ast.asset?.assets[0];
        const exp = _ast?.denom_units.find((d) => d.denom === _ast?.display);
        const balance = await this.client.getBalance(address, _ast.base);
        const ex = !exp?.exponent ? 0 : exp?.exponent;

        return {
            decimals: ex,
            symbol: _ast?.symbol ?? "unknown",
            name: _ast?.name ?? "unknown",
            value: (Number(balance.amount) / 10 ** ex).toString(),
            inBaseUnits: (Number(balance.amount) / 10 ** ex).toString(),
        };
    }

    private async getChainInfo() {
        const id = await this.client.getChainId();
        const chain = chains.find((ch) => ch.chain_id === id);

        if (!chain) throw new Error("Network data is unavailable");

        const asset = assets.find((ast) => ast.chain_name === chain?.chain_name);
        return {
            chain: chain,
            asset: asset,
        };
    }
}

export function cosmos({ client, account }: CosmosWalletOptions) {
    return new CosmosClient({ client, account });
}
