import dotenv from "dotenv";

dotenv.config();

import { createWalletClient } from "viem";
import { http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygon, polygonAmoy } from "viem/chains";

import { createOrder } from "@goat-sdk/plugin-polymarket";
import { viem } from "@goat-sdk/wallet-viem";

const account = privateKeyToAccount(process.env.WALLET_PRIVATE_KEY as `0x${string}`);

const walletClient = createWalletClient({
    account: account,
    transport: http(process.env.ALCHEMY_API_KEY),
    chain: process.env.NETWORK === "polygon" ? polygon : polygonAmoy,
});

const wallet = viem(walletClient);

(async () => {
    try {
        const order = await createOrder(
            wallet,
            {
                key: process.env.POLYMARKET_API_KEY as string,
                secret: process.env.POLYMARKET_SECRET as string,
                passphrase: process.env.POLYMARKET_PASSPHRASE as string,
            },
            {
                type: "GTC",
                tokenId: "96937810338362097614741657517268729837129429712920385069363769157847960753005",
                price: "0.06",
                size: 10,
                expiration: 0,
                side: "BUY",
            },
        );

        console.log(order);
    } catch (error) {
        console.error("Error:", error instanceof Error ? error.message : error);
    }
})();
