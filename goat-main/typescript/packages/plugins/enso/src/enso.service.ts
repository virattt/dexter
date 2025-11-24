import { EnsoClient, RouteParams } from "@ensofinance/sdk";
import { Tool } from "@goat-sdk/core";
import { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { Address, Hash, parseUnits } from "viem";
import { ENSO_ETH, ENSO_SUPPORTED_NETWORKS, MIN_ERC20_ABI } from "./constants";
import { EnsoPluginConstructorParams } from "./enso.plugin";
import { EnsoRouteParameters } from "./parameters";

const ENSO_API_KEY = "1e02632d-6feb-4a75-a157-documentation" as const;

export class EnsoService {
    private _ensoClient: EnsoClient;

    constructor({ apiKey = ENSO_API_KEY }: EnsoPluginConstructorParams) {
        this._ensoClient = new EnsoClient({ apiKey });
    }

    @Tool({
        name: "enso_route",
        description: "Find the most optimal route between tokenIn and tokenOut and execute it",
    })
    async route(walletClient: EVMWalletClient, { tokenIn, tokenOut, amountIn }: EnsoRouteParameters) {
        const chainId = walletClient.getChain().id;
        const sender = walletClient.getAddress() as Address;
        if (!ENSO_SUPPORTED_NETWORKS.has(chainId)) {
            throw Error(`Chain ${chainId} is not supported`);
        }

        try {
            const tokenInRes = await this._ensoClient.getTokenData({
                chainId,
                address: tokenIn as Address,
                includeMetadata: true,
            });
            if (tokenInRes.data.length === 0 || typeof tokenInRes.data[0].decimals !== "number") {
                throw Error(`Token ${tokenIn} is not supported`);
            }
            const tokenInData = tokenInRes.data[0];
            const amountInWei = parseUnits(amountIn, tokenInData.decimals);

            const params: RouteParams = {
                chainId,
                tokenIn: tokenIn as Address,
                tokenOut: tokenOut as Address,
                amountIn: amountInWei.toString(),
                fromAddress: sender,
                receiver: sender,
                spender: sender,
            };
            const routeData = await this._ensoClient.getRouterData(params);

            if (tokenIn.toLowerCase() !== ENSO_ETH) {
                await walletClient.sendTransaction({
                    to: tokenIn as Address,
                    abi: MIN_ERC20_ABI,
                    functionName: "approve",
                    args: [routeData.tx.to as Address, BigInt(amountInWei)],
                });
            }

            const tx = await walletClient.sendTransaction({
                to: routeData.tx.to,
                data: routeData.tx.data as Hash,
                value: BigInt(routeData.tx.value),
            });
            return tx.hash;
        } catch (err) {
            throw Error(`Failed to route through Enso: ${err}`);
        }
    }
}
