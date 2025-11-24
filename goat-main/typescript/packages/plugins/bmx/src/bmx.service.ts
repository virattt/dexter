import { Tool } from "@goat-sdk/core";
import { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { formatUnits } from "viem";
import { ERC20_ABI } from "./abi/erc20";
import { POSITION_ROUTER_ABI } from "./abi/positionRouter";
import { ROUTER_ABI } from "./abi/router";
import { VAULT_ABI } from "./abi/vault";
import { CloseDecreasePositionParams, GetPositionParams, OpenIncreasePositionParams } from "./parameters";

const BMX_ROUTER_ADDRESS = "0xAa40201575140862E9aE4F00515245670582e6e0";
const BMX_POSITION_ROUTER_ADDRESS = "0x6D6ec3bd7c94ab35e7a0a6FdA864EE35eB9fAE04";
const BMX_VAULT_ADDRESS = "0xff745bdB76AfCBa9d3ACdCd71664D4250Ef1ae49";
const REFERRAL_CODE = "0x0000000000000000000000000000000000000000000000000000000000000000";
const CALLBACK_ADDRESS = "0x0000000000000000000000000000000000000000";
const USDC_ADDRESS = "0xd988097fb8612cc24eeC14542bC03424c656005f";

export class BmxService {
    @Tool({
        name: "open_increase_position",
        description: "Open or increase a long or short position on BMX with specified parameters",
    })
    async openIncreasePosition(walletClient: EVMWalletClient, parameters: OpenIncreasePositionParams): Promise<string> {
        const { indexToken, amountIn, leverage, isLong, referralCode = REFERRAL_CODE } = parameters;

        // Get token decimals
        const tokenDecimals = await walletClient.read({
            address: isLong ? indexToken : USDC_ADDRESS, // Use correct token for decimals
            abi: ERC20_ABI,
            functionName: "decimals",
        });
        const tokenDecimalsValue = (tokenDecimals as { value: number }).value;

        // Get index token price from Vault
        const tokenPrice = await walletClient.read({
            address: BMX_VAULT_ADDRESS,
            abi: VAULT_ABI,
            functionName: isLong ? "getMaxPrice" : "getMinPrice",
            args: [indexToken],
        });
        const tokenPriceValue = (tokenPrice as { value: bigint }).value;

        // Calculate sizeDelta in USD
        const amountInBigInt = BigInt(amountIn);
        const sizeDelta = isLong
            ? (amountInBigInt * tokenPriceValue * BigInt(leverage)) / BigInt(10 ** tokenDecimalsValue)
            : (amountInBigInt * BigInt(leverage) * BigInt(1e30)) / BigInt(10 ** tokenDecimalsValue);
        const sizeDeltaValue = sizeDelta; // Using USDC decimals from earlier

        // Calculate acceptable price with 0.5% buffer
        const acceptablePriceValue = isLong
            ? (tokenPriceValue * BigInt(1005)) / BigInt(1000) // -0.5% for longs (must be less than market)
            : (tokenPriceValue * BigInt(995)) / BigInt(1000); // -0.5% for shorts

        // Check if plugin is approved
        const result = await walletClient.read({
            address: BMX_ROUTER_ADDRESS,
            abi: ROUTER_ABI,
            functionName: "approvedPlugins",
            args: [walletClient.getAddress(), BMX_POSITION_ROUTER_ADDRESS],
        });
        const isApproved = (result as { value: boolean }).value;

        if (!isApproved) {
            await walletClient.sendTransaction({
                to: BMX_ROUTER_ADDRESS,
                abi: ROUTER_ABI,
                functionName: "approvePlugin",
                args: [BMX_POSITION_ROUTER_ADDRESS],
            });
        }

        // First approve collateral token if needed
        await walletClient.sendTransaction({
            to: isLong ? indexToken : USDC_ADDRESS,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [BMX_ROUTER_ADDRESS, amountIn],
        });

        const minExecutionFee = await walletClient.read({
            address: BMX_POSITION_ROUTER_ADDRESS,
            abi: POSITION_ROUTER_ABI,
            functionName: "minExecutionFee",
        });
        const minExecutionFeeParsed = (minExecutionFee as { value: bigint }).value;
        const tx = await walletClient.sendTransaction({
            to: BMX_POSITION_ROUTER_ADDRESS,
            abi: POSITION_ROUTER_ABI,
            functionName: "createIncreasePosition",
            args: [
                [isLong ? indexToken : USDC_ADDRESS],
                indexToken,
                amountIn,
                0n,
                sizeDeltaValue,
                isLong,
                acceptablePriceValue,
                minExecutionFeeParsed,
                referralCode,
                CALLBACK_ADDRESS,
            ],
            value: minExecutionFeeParsed,
        });

        return `Position creation transaction submitted. Hash: ${tx.hash}`;
    }

    @Tool({
        name: "close_decrease_position",
        description: "Close or decrease a long or short position on BMX with specified parameters",
    })
    async closeDecreasePosition(
        walletClient: EVMWalletClient,
        parameters: CloseDecreasePositionParams,
    ): Promise<string> {
        const { indexToken, percentage, isLong, referralCode = REFERRAL_CODE } = parameters;

        // Get current position details
        const position = (await walletClient.read({
            address: BMX_VAULT_ADDRESS,
            abi: VAULT_ABI,
            functionName: "getPosition",
            args: [walletClient.getAddress(), isLong ? indexToken : USDC_ADDRESS, indexToken, isLong],
        })) as {
            value: [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
        };

        const currentSize = position.value[0];
        const currentCollateral = position.value[1];

        // Calculate deltas based on percentage
        const sizeDelta = (currentSize * BigInt(percentage)) / BigInt(100);
        const collateralDelta = (currentCollateral * BigInt(percentage)) / BigInt(100);

        // Get token price from Vault - use getMinPrice for both long and short when closing
        const tokenPrice = await walletClient.read({
            address: BMX_VAULT_ADDRESS,
            abi: VAULT_ABI,
            functionName: "getMinPrice", // Always use getMinPrice for closing positions
            args: [indexToken],
        });
        const tokenPriceValue = (tokenPrice as { value: bigint }).value;

        // For closing positions, shorts need price lower than market, longs need price higher than market
        const acceptablePriceValue = isLong
            ? (tokenPriceValue * BigInt(997)) / BigInt(1000) // -0.3% for closing longs
            : (tokenPriceValue * BigInt(1003)) / BigInt(1000); // -0.3% for closing shorts

        const minExecutionFee = await walletClient.read({
            address: BMX_POSITION_ROUTER_ADDRESS,
            abi: POSITION_ROUTER_ABI,
            functionName: "minExecutionFee",
        });
        const minExecutionFeeParsed = (minExecutionFee as { value: bigint }).value;

        // Create the decrease position transaction
        const tx = await walletClient.sendTransaction({
            to: BMX_POSITION_ROUTER_ADDRESS,
            abi: POSITION_ROUTER_ABI,
            functionName: "createDecreasePosition",
            args: [
                [isLong ? indexToken : USDC_ADDRESS],
                indexToken,
                collateralDelta,
                sizeDelta,
                isLong,
                walletClient.getAddress(),
                acceptablePriceValue,
                0n,
                minExecutionFeeParsed,
                false,
                CALLBACK_ADDRESS,
            ],
            value: minExecutionFeeParsed,
        });

        return `Position decrease transaction submitted. Hash: ${tx.hash}`;
    }

    @Tool({
        name: "get_position",
        description: "View current position details for a specific token",
    })
    async getPosition(walletClient: EVMWalletClient, parameters: GetPositionParams): Promise<string> {
        const { indexToken, isLong } = parameters;

        // Get position details
        const position = (await walletClient.read({
            address: BMX_VAULT_ADDRESS,
            abi: VAULT_ABI,
            functionName: "getPosition",
            args: [
                walletClient.getAddress(),
                isLong ? indexToken : USDC_ADDRESS, // collateral token
                indexToken, // index token
                isLong,
            ],
        })) as {
            value: [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
        };

        // Based on docs, values are in this order:
        const [
            size, // position size in USD
            collateral, // position collateral in USD
            averagePrice, // average entry price of position in USD
            entryFundingRate,
            hasRealisedProfit,
            realisedPnl, // realised PnL in USD
            lastIncreasedTime,
            hasProfit, // 1 if in profit, 0 if not
            delta, // current profit/loss in USD
        ] = position.value;

        // Format the position details
        const formattedPosition = {
            size: `${formatUnits(size, 30).toString()} USD`,
            collateral: `${formatUnits(collateral, 30).toString()} USD`,
            averagePrice: `${formatUnits(averagePrice, 30).toString()} USD`,
            realisedPnl: `${formatUnits(realisedPnl, 30).toString()} USD`,
            lastIncreasedTime:
                Number(lastIncreasedTime) > 1600000000
                    ? new Date(Number(lastIncreasedTime) * 1000).toLocaleString()
                    : "No position increases yet",
            hasProfit: Boolean(hasProfit),
        };

        // Return formatted string
        return `Position Details - ${JSON.stringify(formattedPosition)}`;
    }
}
