import type { ApiKeyCredentials } from "./api";
import {
    cancelAllOrdersParametersSchema,
    cancelOrderParametersSchema,
    createOrderParametersSchema,
    getEventsParametersSchema,
    getMarketInfoParametersSchema,
    getOpenOrdersParametersSchema,
} from "./parameters";

import { type ToolBase, createTool } from "@goat-sdk/core";
import type { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { cancelAllOrders, cancelOrder, createOrder, getEvents, getMarketInfo, getOpenOrders } from "./api";

export type PolymarketToolsOptions = {
    credentials: ApiKeyCredentials;
};

export function getTools(walletClient: EVMWalletClient, { credentials }: PolymarketToolsOptions): ToolBase[] {
    return [
        createTool(
            {
                name: "get_polymarket_events",
                description: "Get the events on Polymarket, including their markets, with optional filters",
                parameters: getEventsParametersSchema,
            },
            (parameters) => getEvents(parameters),
        ),
        createTool(
            {
                name: "get_polymarket_market_info",
                description: "Get the info of a specific market on Polymarket",
                parameters: getMarketInfoParametersSchema,
            },
            (parameters) => getMarketInfo(walletClient, parameters),
        ),
        createTool(
            {
                name: "create_order_on_polymarket",
                description: "Create an order on Polymarket",
                parameters: createOrderParametersSchema,
            },
            (parameters) => createOrder(walletClient, credentials, parameters),
        ),
        createTool(
            {
                name: "get_active_polymarket_orders",
                description: "Get the active orders on Polymarket",
                parameters: getOpenOrdersParametersSchema,
            },
            (parameters) => getOpenOrders(walletClient, credentials, parameters),
        ),
        createTool(
            {
                name: "cancel_polymarket_order",
                description: "Cancel an order on Polymarket",
                parameters: cancelOrderParametersSchema,
            },
            (parameters) => cancelOrder(walletClient, credentials, parameters),
        ),
        createTool(
            {
                name: "cancel_all_polymarket_orders",
                description: "Cancel all orders on Polymarket",
                parameters: cancelAllOrdersParametersSchema,
            },
            (_parameters) => cancelAllOrders(walletClient, credentials),
        ),
    ];
}
