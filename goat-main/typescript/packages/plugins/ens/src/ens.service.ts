import { Tool } from "@goat-sdk/core";
import { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { http, createPublicClient } from "viem";
import * as chains from "viem/chains";
import { normalize } from "viem/ens";
import { EnsParameters } from "./parameters";

export class EnsService {
    constructor(
        private readonly provider: string | undefined,
        private readonly chainId: number | undefined,
    ) {}

    @Tool({
        name: "get_address_from_ens",
        description: "Get the address from an ENS (Ethereum Name Service, e.g. goat.eth) name",
    })
    async getAddressFromEns(walletClient: EVMWalletClient, parameters: EnsParameters) {
        let chainId = walletClient.getChain().id;

        if (this.chainId) {
            chainId = this.chainId;
        }

        const chainsArray = Object.values(chains);
        const chain = chainsArray.find((c) => c.id === chainId);

        const client = createPublicClient({
            chain: chain,
            transport: http(this.provider),
        });

        const address = await client.getEnsAddress({
            name: normalize(parameters.ensName),
        });

        return address;
    }
}
