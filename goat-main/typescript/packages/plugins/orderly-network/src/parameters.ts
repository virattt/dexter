import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

export class DepositOrderlyParams extends createToolParameters(
    z.object({
        amount: z.string().describe("The amount of input tokens to deposit in base units"),
    }),
) {}

export class WithdrawOrderlyParams extends createToolParameters(
    z.object({
        amount: z.string().describe("The amount of input tokens to withdraw in base units"),
    }),
) {}

export class CreateOrderOrderlyParams extends createToolParameters(
    z.object({
        symbol: z.string().describe("Allowed symbol by network and token"),
        order_type: z.enum(["MARKET", "LIMIT", "IOC", "FOK", "POST_ONLY", "ASK", "BID"]).describe(
            `Order type:
- MARKET: Matches until the full size is executed; if the quantity is too large or the matching price exceeds the limit (refer to price_range), the remaining quantity will be cancelled.
- IOC: Matches as much as possible at the specified order_price; any unexecuted portion will be cancelled.
- FOK: The order is fully executed only if it can be completely matched at the order_price; otherwise, it is cancelled without any execution.
- POST_ONLY: If the order would execute any maker trades upon placement, it will be cancelled without execution.
- ASK: The order price is guaranteed to be the best ask price in the order book at the time of acceptance.
- BID: The order price is guaranteed to be the best bid price in the order book at the time of acceptance.`,
        ),
        order_price: z
            .string()
            .optional()
            .describe("The price of the order; required for LIMIT, IOC, FOK, and POST_ONLY orders."),
        order_quantity: z
            .string()
            .optional()
            .describe(
                `Order quantity in base units.
            For MARKET/BID/ASK orders in Futures mode, use order_quantity for both BUY and SELL orders.`,
            ),
        order_amount: z
            .string()
            .optional()
            .describe(
                `Order size in terms of the quote currency.
            (Not supported for BUY orders in Futures mode).`,
            ),
        visible_quantity: z
            .string()
            .optional()
            .describe(
                `Maximum quantity displayed on the order book. Defaults to order_quantity.
Negative values or values larger than order_quantity are not allowed. If set to 0, the order will be hidden from the order book.
Does not apply to MARKET/IOC/FOK orders since those orders are executed and cancelled immediately.`,
            ),
        client_order_id: z
            .string()
            .optional()
            .describe(
                `Custom order ID, unique among open orders.
Orders with the same client_order_id are accepted only when the previous one is completed; otherwise, the order will be rejected.`,
            ),
        side: z.enum(["BUY", "SELL"]).describe("The side of the order: BUY or SELL."),
    }),
) {}

export class ClosePositionOrderlyParams extends createToolParameters(
    z.object({
        symbol: z.string().describe("The symbol is required"),
    }),
) {}

export class GetAllowedSymbolByNetworkParams extends createToolParameters(
    z.object({
        network: z.enum(["mainnet", "testnet"]).describe("The network"),
        token: z.string().describe("The token symbol"),
    }),
) {}

export class GetUSDCInfoOrderlyParams extends createToolParameters(
    z.object({
        symbol: z.string().describe("Get info for USDC tokens supported by Orderly Network."),
    }),
) {}

export class GetUSDCBalanceHoldingsOrderlyParams extends createToolParameters(
    z.object({
        symbol: z.string().describe("Get balance info for tokens supported by Orderly Network."),
    }),
) {}
