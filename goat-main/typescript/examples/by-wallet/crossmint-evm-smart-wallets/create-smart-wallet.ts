import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.CROSSMINT_STAGING_API_KEY;
const walletAddress = process.env.SIGNER_WALLET_ADDRESS;
const walletSignerSecretKey = process.env.SIGNER_WALLET_SECRET_KEY;

if (!apiKey || !walletAddress || !walletSignerSecretKey) {
    throw new Error("Missing environment variables");
}

(async () => {
    const response = await createWallet(walletAddress as `0x${string}`, apiKey);

    if (response.error) {
        console.error(response);
        return;
    }

    console.log(`Created wallet: ${response.address}`);
    console.log(`Details: ${JSON.stringify(response, null, 2)}`);
})();

async function createWallet(signerPublicKey: `0x${string}`, apiKey: string) {
    const response = await fetch("https://staging.crossmint.com/api/2022-06-09/wallets", {
        method: "POST",
        headers: {
            "X-API-KEY": apiKey,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            type: "evm-smart-wallet",
            config: {
                adminSigner: {
                    type: "evm-keypair",
                    address: signerPublicKey,
                },
            },
        }),
    });

    return await response.json();
}
