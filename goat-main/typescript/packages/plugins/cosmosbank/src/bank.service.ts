import { Tool } from "@goat-sdk/core";
import { CosmosClient } from "@goat-sdk/wallet-cosmos";
import { assets, chains } from "chain-registry";
import {
    QueryBalanceRequest,
    QueryBalanceResponse,
    QueryDenomMetadataRequest,
    QueryDenomMetadataResponse,
    QuerySupplyOfRequest,
    QuerySupplyOfResponse,
} from "cosmjs-types/cosmos/bank/v1beta1/query";
import {
    denomMetadataParametersSchema,
    getBalanceParametersSchema,
    sendTokenObjectParametersSchema,
    supplyOfParametersSchema,
} from "./parameters";

export class BankService {
    @Tool({
        description: "Gets the balance of a token denom in base units. Convert to decimal units before returning.",
    })
    async tokenBalance(walletClient: CosmosClient, parameters: getBalanceParametersSchema) {
        try {
            const t = await this.getChainInfo(walletClient);
            const _d = t.asset?.assets.find((a) => a.symbol === parameters.symbol);

            if (!_d) throw new Error("the Requested Token is unavailabe on the network");

            const data = QueryBalanceRequest.encode({ address: parameters.address, denom: _d?.base }).finish();
            const message = { typeUrl: "/cosmos.bank.v1beta1.Query/Balance", value: data };

            const rawBalance = await walletClient.read({ message });
            const decode = QueryBalanceResponse.decode(rawBalance.value.value);

            if (!decode?.balance) throw new Error("the requested balance is unavailable");

            const ex = t.asset?.assets.find((a) => a.base === decode.balance?.denom);
            const xp = ex?.denom_units.find((d) => d.denom === ex?.display)?.exponent ?? 0;
            const bal = await this.convertFromBaseUnit(Number(decode.balance.amount), xp);
            return bal.toString();
        } catch (error) {
            throw Error(`Failed to fetch balance: ${error}`);
        }
    }

    @Tool({
        description: "Get the metadata of a token with the specified symbol.",
    })
    async demonMetada(walletClient: CosmosClient, parameters: denomMetadataParametersSchema) {
        try {
            const _d = (await this.getChainInfo(walletClient)).asset?.assets.find(
                (a) => a.symbol === parameters.symbol,
            );

            if (!_d) throw new Error("the Requested Token is unavailabe on the network");

            const data = QueryDenomMetadataRequest.encode({ denom: _d?.base }).finish();
            const message = { typeUrl: "/cosmos.bank.v1beta1.Query/DenomMetadata", value: data };

            const metadata = await walletClient.read({ message });
            const decode = QueryDenomMetadataResponse.decode(metadata.value.value);

            if (!decode.metadata) throw new Error("the requested metadata is unavailable");

            return `${decode.metadata.display}-${decode.metadata.name}-${decode.metadata.description}
            -${decode.metadata.symbol}`;
        } catch (error) {
            throw Error(`Failed to fetch denom metadata: ${error}`);
        }
    }

    @Tool({
        description: "Get the total supply of a token with the specified symbol.",
    })
    async supplyOf(walletClient: CosmosClient, parameters: supplyOfParametersSchema) {
        try {
            const t = await this.getChainInfo(walletClient);
            const _d = t.asset?.assets.find((a) => a.symbol === parameters.symbol);

            if (!_d) throw new Error("the Requested Token is unavailabe on the network");

            const data = QuerySupplyOfRequest.encode({ denom: _d?.base }).finish();
            const message = { typeUrl: "/cosmos.bank.v1beta1.Query/SupplyOf", value: data };

            const supplyof = await walletClient.read({ message });
            const decode = QuerySupplyOfResponse.decode(supplyof.value.value);

            if (!decode.amount) throw new Error("the requested token data is unavailable");

            const ex = t.asset?.assets.find((a) => a.base === decode.amount?.denom);
            const xp = ex?.denom_units.find((d) => d.denom === ex?.display)?.exponent ?? 0;
            const total = await this.convertFromBaseUnit(Number(decode.amount.amount), xp);
            return `$${total.toString()}_${decode.amount.denom}`;
        } catch (error) {
            throw Error(`Failed to fetch total supply: ${error}`);
        }
    }

    @Tool({
        description: "Sends an amount of a Token of a specified symbol to a receivers address.",
    })
    async sendToken(walletClient: CosmosClient, parameters: sendTokenObjectParametersSchema) {
        try {
            const t = await this.getChainInfo(walletClient);
            const _d = t.asset?.assets.find((a) => a.symbol === parameters.amount.symbol);

            if (!_d) throw new Error("the Requested Token is unavailabe on the network");

            const ex = t.asset?.assets.find((a) => a.base === _d?.base);
            const xp = ex?.denom_units.find((d) => d.denom === ex?.display)?.exponent ?? 0;
            const amount = await this.convertToBaseUnit(Number(parameters.amount.amount), xp);

            const hash = await walletClient.sendTransaction({
                message: {
                    typeUrl: "/cosmos.bank.v1beta1.MsgSend",
                    value: {
                        fromAddress: walletClient.getAddress(),
                        toAddress: parameters.toAddress,
                        amount: [{ denom: _d?.base, amount: amount.toString() }],
                    },
                },
            });

            if (!hash.value.transactionHash) throw new Error("transaction was incomplete");

            return hash.value.transactionHash;
        } catch (error) {
            throw Error(`Failed to send token: ${error}`);
        }
    }

    private async getChainInfo(walletClient: CosmosClient) {
        const id = await walletClient.getChainId();
        const chain = chains.find((ch) => ch.chain_id === id);

        if (!chain) throw new Error("Network data is unavailable");

        const asset = assets.find((ast) => ast.chain_name === chain?.chain_name);
        return {
            chain: chain,
            asset: asset,
        };
    }

    private async convertToBaseUnit(amount: number, decimals: number) {
        const baseUnit = amount * 10 ** decimals;
        return Number(baseUnit);
    }

    private async convertFromBaseUnit(amount: number, decimals: number) {
        const decimalUnit = amount / 10 ** decimals;
        return Number(decimalUnit);
    }
}
