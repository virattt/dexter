import { type Quote, executeSwap, fetchQuotes } from "@avnu/avnu-sdk";
import { Tool } from "@goat-sdk/core";
import { StarknetAccountWalletClient } from "@goat-sdk/wallet-starknet";
import { SwapConfigParams } from "./parameters";

export class AvnuService {
    private options = {
        baseUrl: "https://starknet.api.avnu.fi",
    };

    private async getQuote(params: {
        sellTokenAddress: string;
        buyTokenAddress: string;
        sellAmount: string;
    }): Promise<Quote[]> {
        try {
            const sellAmountBigInt = BigInt(params.sellAmount);

            const quotes = await fetchQuotes(
                {
                    sellTokenAddress: params.sellTokenAddress,
                    buyTokenAddress: params.buyTokenAddress,
                    sellAmount: sellAmountBigInt,
                },
                this.options,
            );

            if (!quotes || quotes.length === 0) {
                throw new Error("No quotes found");
            }

            return quotes;
        } catch (error) {
            if (error instanceof Error && error.message.includes("BigInt")) {
                throw new Error(`Invalid sellAmount format: ${params.sellAmount}`);
            }
            throw new Error(`Error fetching quotes: ${error}`);
        }
    }

    @Tool({
        name: "executeSwap",
        description: `Executes a token swap on Avnu DEX. 
        IMPORTANT: Never use placeholder any kind of placeholder values. 
        Always get actual token addresses and converted amounts before executing a swap.
        You are a helpful assistant that executes token swaps on Starknet. 

To perform a swap, you MUST follow these steps in order and use the EXACT values returned from each tool:

1. Get token addresses:
   For each token (sell and buy), either:
   - If a symbol is provided (like ETH, USDC, STARK): use get_token_info_by_symbol
   - If an address is provided: use that address directly
   Save both addresses for use in step 3

2. Use convert_to_base_unit:
   - Use the amount from user's request
   - Save the exact number returned

3. Use executeSwap:
   - sellTokenAddress: Use the address from step 1 for sell token
   - buyTokenAddress: Use the address from step 1 for buy token
   - sellAmount: Use the EXACT number from step 2

Example flows:
1. Using symbols:
   - get_token_info_by_symbol("USDC") -> returns address1
   - get_token_info_by_symbol("STARK") -> returns address2
   - convert_to_base_unit("0.01") -> returns amount
   - executeSwap with {sellTokenAddress: address1, buyTokenAddress: address2, sellAmount: amount}

2. Using addresses:
   - Sell token address provided directly: 0x123...
   - Buy token address provided directly: 0x456...
   - convert_to_base_unit("0.01") -> returns amount
   - executeSwap with {sellTokenAddress: "0x123...", buyTokenAddress: "0x456...", sellAmount: amount}

DO NOT proceed to the next step until you have the actual values from the current step.
DO NOT use placeholder values like <TOKEN_ADDRESS> or <BASE_UNIT_AMOUNT>.`,
    })
    async executeSwap(walletClient: StarknetAccountWalletClient, params: SwapConfigParams) {
        try {
            const quotes = await this.getQuote(params);
            const bestQuote = quotes[0]; // Assuming the first quote is the best one

            const swapResponse = await executeSwap(
                walletClient.getAccount(),
                bestQuote,
                {
                    executeApprove: true,
                    slippage: params.slippage,
                },
                this.options,
            );
            return swapResponse;
        } catch (error) {
            throw new Error(`Error executing swap: ${error}`);
        }
    }
}
