import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.CROSSMINT_STAGING_API_KEY;
const walletAddress = process.env.SIGNER_WALLET_ADDRESS;

if (!apiKey || !walletAddress) {
    throw new Error("Missing environment variables");
}

(async () => {
    const response = await createWallet(walletAddress as string, apiKey);

    if (response.error) {
        console.error(response);
        return;
    }

    console.log(`Created wallet: ${response.address}`);
    console.log(`Details: ${JSON.stringify(response, null, 2)}`);
})();

async function createWallet(signerPublicKey: string, apiKey: string) {
    const response = await fetch("https://staging.crossmint.com/api/2022-06-09/wallets", {
        method: "POST",
        headers: {
            "X-API-KEY": apiKey,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            type: "solana-smart-wallet",
            config: {
                adminSigner: {
                    type: "solana-keypair",
                    address: signerPublicKey,
                },
            },
        }),
    });

    return await response.json();
}
