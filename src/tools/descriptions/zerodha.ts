export const ZERODHA_HOLDINGS_DESCRIPTION = `
Get long-term equity holdings from the Zerodha portfolio (Indian market).

## When to Use

- User asks for their Zerodha holdings, portfolio, or long-term equity positions
- Before discussing what they hold in India

## When NOT to Use

- For open intraday/short-term positions (use \`zerodha_positions\`)
- For US or other non-Indian holdings (use \`financial_search\` or \`financial_metrics\`)
`.trim();

export const ZERODHA_POSITIONS_DESCRIPTION = `
Get open short-term (intraday/MIS) positions from Zerodha.

## When to Use

- User asks for open positions, intraday positions, or current trades on Zerodha
`.trim();

export const ZERODHA_MARGINS_DESCRIPTION = `
Get margin information for equity or commodity segment from Zerodha.

## When to Use

- User asks for available margin, collateral, or margin used
`.trim();

export const ZERODHA_ORDERS_DESCRIPTION = `
Get list of all orders (open and executed) for the day from Zerodha.

## When to Use

- User asks for today's orders, order status, or order history for the day
`.trim();

export const ZERODHA_INSTRUMENTS_DESCRIPTION = `
Get list of instruments from Zerodha for an exchange. Use to look up tradingsymbol for placing orders.

## When to Use

- Need to find the correct tradingsymbol or instrument token for a stock (e.g. NSE:RELIANCE)
- User wants to search instruments by exchange
`.trim();

export const ZERODHA_QUOTE_DESCRIPTION = `
Get live quote for one or more instruments from Zerodha. Instruments in format exchange:tradingsymbol (e.g. NSE:RELIANCE).

## When to Use

- User asks for live price, LTP, or quote for an Indian stock on Zerodha
`.trim();

export const ZERODHA_PLACE_ORDER_DESCRIPTION = `
Place an order on Zerodha Kite (Indian market). **Requires explicit user approval** before execution.

## When to Use

- User has **explicitly asked** to buy or sell a specific quantity of a stock (e.g. "Buy 10 shares of Reliance", "Sell my INFY position")
- Do NOT use for hypotheticals, suggestions, or without clear user consent

## When NOT to Use

- User is only asking for research, price, or "what if" scenarios
- User has not clearly consented to place the order

## Usage Notes

- The system will prompt the user for confirmation before placing the order
- Required: exchange, tradingsymbol, transaction_type (BUY/SELL), quantity, order_type, product
- For LIMIT orders provide \`price\`; for SL/SL-M provide \`trigger_price\`
`.trim();

export const ZERODHA_MODIFY_ORDER_DESCRIPTION = `
Modify an existing order on Zerodha Kite. **Requires explicit user approval** before execution.

## When to Use

- User has **explicitly asked** to modify an order (change price, quantity, or cancel intent expressed as modify)
`.trim();

export const ZERODHA_CANCEL_ORDER_DESCRIPTION = `
Cancel an existing order on Zerodha Kite. **Requires explicit user approval** before execution.

## When to Use

- User has **explicitly asked** to cancel a specific order
`.trim();
