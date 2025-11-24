import { Tool, WalletClientBase } from "@goat-sdk/core";
import { JSONRpcBodySchema } from "./parameters";

export class JSONRpcService {
    private endpoint: string;

    constructor({ endpoint }: { endpoint?: string } = {}) {
        this.endpoint = endpoint ?? "";
    }

    @Tool({
        description: "Make a remote procedure call to a JSON RPC endpoint",
    })
    async JSONRpcFunc(walletClient: WalletClientBase, parameters: JSONRpcBodySchema) {
        try {
            const url = new URL(`${this.endpoint}`);

            const response = await fetch(url.toString(), {
                method: "POST",
                body: JSON.stringify(parameters),
                headers: {},
            });
            console.log(response, "string");
            if (!response.ok) {
                throw new Error(`Failed to fetch: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            throw Error(`Failed to call endpoint: ${error}`);
        }
    }
}
