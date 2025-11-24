import dotenv from "dotenv";

dotenv.config();

import { createWalletClient } from "viem";
import { http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygon } from "viem/chains";

import { createOrDeriveAPIKey } from "@goat-sdk/plugin-polymarket";
import { viem } from "@goat-sdk/wallet-viem";

const account = privateKeyToAccount(process.env.WALLET_PRIVATE_KEY as `0x${string}`);

const walletClient = createWalletClient({
    account: account,
    transport: http(process.env.RPC_PROVIDER_URL),
    chain: polygon,
});

const wallet = viem(walletClient);

(async () => {
    const credentials = await createOrDeriveAPIKey(wallet);

    console.log(credentials);
})();
