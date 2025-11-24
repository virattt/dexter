import type { EvmChain } from "@goat-sdk/core";
import type { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { parseUnits } from "viem";
import { polygon } from "viem/chains";
import { z } from "zod";
import { COLLATERAL_TOKEN_DECIMALS, CONDITIONAL_TOKEN_DECIMALS, getContractConfig } from "./contracts";
import type {
    cancelOrderParametersSchema,
    createOrderParametersSchema,
    getEventsParametersSchema,
    getMarketInfoParametersSchema,
    getOpenOrdersParametersSchema,
} from "./parameters";
import {
    ROUNDING_CONFIG,
    appendSearchParams,
    buildClobEip712Signature,
    buildPolyHmacSignature,
    getExpirationTimestamp,
    getOrderRawAmounts,
    priceValid,
    transformMarketOutcomes,
} from "./utils";

const GAMMA_URL = "https://gamma-api.polymarket.com";

function getBaseUrl(chain: EvmChain): string {
    return chain.id === polygon.id ? "https://clob.polymarket.com" : "https://clob-staging.polymarket.com";
}

export type ApiKeyCredentials = {
    key: string;
    secret: string;
    passphrase: string;
};

export enum Side {
    BUY = "BUY",
    SELL = "SELL",
}

export enum IntSide {
    BUY = 0,
    SELL = 1,
}

export enum OrderType {
    GTC = "GTC",
    FOK = "FOK",
    GTD = "GTD",
}

type L2HeadersArgs = {
    method: string;
    requestPath: string;
    body?: string;
};

export type TickSize = "0.1" | "0.01" | "0.001" | "0.0001";

const Event = z.object({
    active: z.boolean(),
    archived: z.boolean(),
    closed: z.boolean(),
    commentCount: z.number().optional(),
    creationDate: z.string(),
    description: z.string(),
    endDate: z.string(),
    liquidity: z.number().optional(),
    markets: z.array(
        z.object({
            acceptingOrders: z.boolean(),
            clobTokenIds: z.string(),
            description: z.string(),
            oneDayPriceChange: z.number().optional(),
            orderMinSize: z.number(),
            orderPriceMinTickSize: z.number(),
            outcomePrices: z.string().optional(),
            outcomes: z.string(),
            question: z.string().optional(),
            slug: z.string(),
            volume: z.string().optional(),
        }),
    ),
    slug: z.string(),
    startDate: z.string(),
    tags: z.array(
        z.object({
            id: z.string().optional(),
            label: z.string().optional(),
            slug: z.string(),
        }),
    ),
    title: z.string(),
    updatedAt: z.string().optional(),
    volume: z.number().optional(),
    volume24hr: z.number().optional(),
});

export enum SignatureType {
    EOA = 0,
    POLY_PROXY = 1,
    POLY_GNOSIS_SAFE = 2,
}

export const ORDER_STRUCTURE = [
    { name: "salt", type: "uint256" },
    { name: "maker", type: "address" },
    { name: "signer", type: "address" },
    { name: "taker", type: "address" },
    { name: "tokenId", type: "uint256" },
    { name: "makerAmount", type: "uint256" },
    { name: "takerAmount", type: "uint256" },
    { name: "expiration", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "feeRateBps", type: "uint256" },
    { name: "side", type: "uint8" },
    { name: "signatureType", type: "uint8" },
];

export const PROTOCOL_NAME = "Polymarket CTF Exchange";
export const PROTOCOL_VERSION = "1";

async function getHostTimestamp(chain: EvmChain): Promise<number> {
    const response = await fetch(`${getBaseUrl(chain)}/time`);
    const data = await response.text();
    return Number.parseInt(data, 10);
}

async function createL1Headers(
    walletClient: EVMWalletClient,
    timestamp: number,
    nonce = 0,
): Promise<Record<string, string>> {
    const signature = await buildClobEip712Signature(walletClient, timestamp, nonce);
    const address = walletClient.getAddress();

    return {
        POLY_ADDRESS: address,
        POLY_SIGNATURE: signature,
        POLY_TIMESTAMP: timestamp.toString(),
        POLY_NONCE: nonce.toString(),
    };
}

async function createL2Headers(
    walletClient: EVMWalletClient,
    credentials: ApiKeyCredentials,
    { method, requestPath, body }: L2HeadersArgs,
) {
    const address = walletClient.getAddress();
    const timestamp = await getHostTimestamp(walletClient.getChain());

    const sig = buildPolyHmacSignature(credentials.secret, timestamp, method, requestPath, body);

    const headers = {
        POLY_ADDRESS: address,
        POLY_SIGNATURE: sig,
        POLY_TIMESTAMP: `${timestamp}`,
        POLY_API_KEY: credentials.key,
        POLY_PASSPHRASE: credentials.passphrase,
    };

    return headers;
}

async function getTickSize(chain: EvmChain, tokenId: string) {
    const url = `${getBaseUrl(chain)}/tick-size/${tokenId}`;
    const response = await fetch(url.toString());
    if (!response.ok) {
        throw new Error(`Failed to fetch tick size: ${response.statusText}`);
    }

    const result = await response.json();
    return result.minimum_tick_size;
}

async function getNegativeRiskAdapter(chain: EvmChain, tokenId: string) {
    const url = `${getBaseUrl(chain)}/neg-risk/${tokenId}`;
    const response = await fetch(url.toString());

    if (!response.ok) {
        throw new Error(`Failed to fetch negative risk: ${response.statusText}`);
    }

    const result = await response.json();
    return result.neg_risk as boolean;
}

export async function createOrDeriveAPIKey(walletClient: EVMWalletClient, nonce?: number): Promise<ApiKeyCredentials> {
    const timestamp = await getHostTimestamp(walletClient.getChain());
    const headers = await createL1Headers(walletClient, timestamp, nonce);

    // Try to create a new API key
    let response = await fetch(`${getBaseUrl(walletClient.getChain())}/auth/api-key`, {
        method: "POST",
        headers,
    });

    if (response.ok) {
        const data = await response.json();
        return {
            key: data.apiKey,
            secret: data.secret,
            passphrase: data.passphrase,
        };
    }

    // If creation fails, attempt to derive the API key
    response = await fetch(`${getBaseUrl(walletClient.getChain())}/auth/derive-api-key`, {
        method: "GET",
        headers,
    });

    if (!response.ok) {
        throw new Error(`Failed to create or derive API key: ${response.statusText}`);
    }

    const data = await response.json();
    return {
        key: data.apiKey,
        secret: data.secret,
        passphrase: data.passphrase,
    };
}

export async function getEvents(
    parameters: z.infer<typeof getEventsParametersSchema>,
    // biome-ignore lint/suspicious/noExplicitAny: Need to create a schema for the response
): Promise<any> {
    const url = new URL(`${GAMMA_URL}/events`);

    // Filter out the showOnlyMarketsAcceptingOrders parameter, it's not a valid query parameter
    const { showOnlyMarketsAcceptingOrders, ...filteredParams } = parameters;
    appendSearchParams(url, filteredParams);

    const response = await fetch(url.toString());
    if (!response.ok) {
        throw new Error(`Failed to fetch events: ${response.statusText}`);
    }

    let events = z.array(Event).parse(await response.json());

    if (showOnlyMarketsAcceptingOrders) {
        events = events.map((event) => ({
            ...event,
            markets: event.markets.filter((market) => market.acceptingOrders),
        }));
    }

    return events.map((event) => ({
        ...event,
        markets: event.markets.map((market) => ({
            ...transformMarketOutcomes(market),
        })),
    }));
}

export async function getMarketInfo(
    walletClient: EVMWalletClient,
    parameters: z.infer<typeof getMarketInfoParametersSchema>,
) {
    const chain = walletClient.getChain();
    const url = new URL(`${getBaseUrl(chain)}/markets/${parameters.id}`);

    const response = await fetch(url.toString());

    if (!response.ok) {
        throw new Error(`Failed to fetch market info: ${response.statusText}`);
    }

    return await response.json();
}

export async function createOrder(
    walletClient: EVMWalletClient,
    credentials: ApiKeyCredentials,
    parameters: z.infer<typeof createOrderParametersSchema>,
) {
    const chain = walletClient.getChain();
    const tokenId = parameters.tokenId;
    const price = parameters.price;
    const orderType = parameters.type as OrderType;
    const expiration = orderType === OrderType.GTD ? getExpirationTimestamp(parameters.expiration).toString() : "0";
    const size = parameters.size;
    const side = parameters.side as Side;
    const fees = "0";
    const tickSize = await getTickSize(chain, tokenId);

    if (!priceValid(Number(price), tickSize)) {
        throw new Error(`Invalid price (${price}), min: ${tickSize} - max: ${1 - tickSize}`);
    }

    const usesNegRiskAdapter = await getNegativeRiskAdapter(chain, tokenId);
    const exchangeContract = getContractConfig(chain, usesNegRiskAdapter);
    const funderAddress = walletClient.getAddress();

    const {
        side: intSide,
        rawMakerAmt,
        rawTakerAmt,
    } = getOrderRawAmounts(side, Number(size), Number(price), ROUNDING_CONFIG[tickSize as TickSize]);

    const makerAmount = parseUnits(rawMakerAmt.toString(), COLLATERAL_TOKEN_DECIMALS).toString();
    const takerAmount = parseUnits(rawTakerAmt.toString(), CONDITIONAL_TOKEN_DECIMALS).toString();

    // Make order public to everyone
    const taker = "0x0000000000000000000000000000000000000000";
    // Nonce
    const nonce = "0";

    // Sign order
    const signatureType = SignatureType.EOA;
    const salt = Math.round(Math.random() * Date.now());

    const dataToSign = {
        primaryType: "Order",
        types: {
            Order: ORDER_STRUCTURE,
        },
        domain: {
            name: PROTOCOL_NAME,
            version: PROTOCOL_VERSION,
            chainId: chain.id,
            verifyingContract: exchangeContract as `0x${string}`,
        },
        message: {
            salt: salt,
            maker: funderAddress,
            signer: funderAddress,
            taker: taker,
            tokenId: tokenId,
            makerAmount: makerAmount,
            takerAmount: takerAmount,
            side: intSide,
            expiration: expiration,
            nonce: nonce,
            feeRateBps: fees,
            signatureType: signatureType,
        },
    };

    const { signature } = await walletClient.signTypedData(dataToSign);

    const payload = {
        order: {
            salt: salt,
            maker: funderAddress,
            signer: funderAddress,
            taker: taker,
            tokenId: tokenId,
            makerAmount: makerAmount,
            takerAmount: takerAmount,
            side,
            expiration: expiration,
            nonce: nonce,
            feeRateBps: fees,
            signatureType: signatureType,
            signature: signature,
        },
        owner: credentials.key,
        orderType: orderType,
    };

    // Submit order
    const timestamp = await getHostTimestamp(chain);

    const sig = buildPolyHmacSignature(credentials.secret, timestamp, "POST", "/order", JSON.stringify(payload));

    const headers = {
        POLY_ADDRESS: walletClient.getAddress(),
        POLY_SIGNATURE: sig,
        POLY_TIMESTAMP: `${timestamp}`,
        POLY_API_KEY: credentials.key,
        POLY_PASSPHRASE: credentials.passphrase,
    };

    const response = await fetch(`${getBaseUrl(chain)}/order`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const responseJson = await response.json();
        if (responseJson.error === "not enough balance / allowance") {
            const totalPrice = Number(price) * size;
            return `You don't have enough funds for this bet. Total cost: ${totalPrice} USDC. If you do, then you need to give Polymarket allowance.`;
        }
        throw new Error(`Failed to create order: ${JSON.stringify(responseJson)}`);
    }

    return await response.json();
}

export async function getOpenOrders(
    walletClient: EVMWalletClient,
    credentials: ApiKeyCredentials,
    parameters: z.infer<typeof getOpenOrdersParametersSchema>,
) {
    const url = new URL(`${getBaseUrl(walletClient.getChain())}/data/orders`);
    appendSearchParams(url, parameters);

    const headers = await createL2Headers(walletClient, credentials, {
        method: "GET",
        requestPath: "/data/orders",
    });

    const response = await fetch(url, {
        method: "GET",
        headers,
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch open orders: ${response.statusText}`);
    }

    return await response.json();
}

export async function cancelOrder(
    walletClient: EVMWalletClient,
    credentials: ApiKeyCredentials,
    parameters: z.infer<typeof cancelOrderParametersSchema>,
) {
    const body = { orderID: parameters.id };
    const headers = await createL2Headers(walletClient, credentials, {
        method: "DELETE",
        requestPath: "/order",
        body: JSON.stringify(body),
    });

    const response = await fetch(`${getBaseUrl(walletClient.getChain())}/order`, {
        method: "DELETE",
        headers,
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error(`Failed to cancel order: ${response.statusText}`);
    }

    return await response.json();
}

export async function cancelAllOrders(walletClient: EVMWalletClient, credentials: ApiKeyCredentials) {
    const headers = await createL2Headers(walletClient, credentials, {
        method: "DELETE",
        requestPath: "/cancel-all",
    });

    const response = await fetch(`${getBaseUrl(walletClient.getChain())}/cancel-all`, {
        method: "DELETE",
        headers,
    });

    if (!response.ok) {
        throw new Error(`Failed to cancel all orders: ${response.statusText}`);
    }

    return await response.json();
}
