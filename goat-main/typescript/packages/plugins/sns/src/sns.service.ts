import { resolve } from "@bonfida/spl-name-service";
import { Tool } from "@goat-sdk/core";
import { SolanaWalletClient } from "@goat-sdk/wallet-solana";
import { ResolveSNSDomainParameters } from "./parameters";

export class SNSService {
    @Tool({
        description: "Resolves an SNS domain name to a Solana address",
    })
    async resolveSNSDomain(walletClient: SolanaWalletClient, parameters: ResolveSNSDomainParameters) {
        try {
            const domain = parameters.domain;
            const publicKey = await resolve(walletClient.getConnection(), domain);
            return publicKey.toBase58();
        } catch (error) {
            throw Error(`Failed to resolve SNS domain: ${error}`);
        }
    }
}
