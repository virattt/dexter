import { Tool } from "@goat-sdk/core";
import { SolanaWalletClient } from "@goat-sdk/wallet-solana";
import { transfer } from "@metaplex-foundation/mpl-bubblegum";
import { getAssetWithProof } from "@metaplex-foundation/mpl-bubblegum";
import { mplBubblegum } from "@metaplex-foundation/mpl-bubblegum";
import { publicKey } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { toWeb3JsInstruction } from "@metaplex-foundation/umi-web3js-adapters";
import { TransferNftParameters } from "./parameters";

export class SolanaNftsService {
    @Tool({
        description: "Send an NFT from your wallet to another address",
    })
    async transferNFT(walletClient: SolanaWalletClient, parameters: TransferNftParameters) {
        const { recipientAddress, assetId } = parameters;
        const umi = createUmi(walletClient.getConnection());
        const bubbleGumUni = umi.use(mplBubblegum());

        const assetWithProof = await getAssetWithProof(umi, publicKey(assetId), {
            truncateCanopy: true,
        });
        const instructions = transfer(bubbleGumUni, {
            ...assetWithProof,
            leafOwner: publicKey(walletClient.getAddress()),
            newLeafOwner: publicKey(recipientAddress),
        }).getInstructions();

        const result = await walletClient.sendTransaction({
            instructions: instructions.map(toWeb3JsInstruction),
        });

        return result.hash;
    }
}
