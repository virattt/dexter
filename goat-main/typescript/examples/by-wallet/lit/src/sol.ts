import type { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor, createStructuredChatAgent } from "langchain/agents";
import { pull } from "langchain/hub";

import {
    Connection,
    Keypair,
    LAMPORTS_PER_SOL,
    PublicKey,
    SystemProgram,
    Transaction,
    clusterApiUrl,
    sendAndConfirmTransaction,
} from "@solana/web3.js";

import { getOnChainTools } from "@goat-sdk/adapter-langchain";
import {
    createEthersWallet,
    createLitContractsClient,
    createLitNodeClient,
    generateWrappedKey,
    getPKPSessionSigs,
    getWrappedKeyMetadata,
    lit,
    mintCapacityCredit,
    mintPKP,
} from "@goat-sdk/wallet-lit";
import { sendSOL } from "@goat-sdk/wallet-solana";

import { LIT_NETWORK as _LIT_NETWORK } from "@lit-protocol/constants";

import { ethers } from "ethers";

require("dotenv").config();

const WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY as `0x${string}`;
const LIT_NETWORK = _LIT_NETWORK.DatilTest;

const llm = new ChatOpenAI({
    model: "gpt-4o-mini",
});

(async (): Promise<void> => {
    console.log("🔄 Creating Lit Node Client...");
    const litNodeClient = await createLitNodeClient(LIT_NETWORK);

    console.log("🔄 Creating Ethers Wallet...");
    const ethersWallet = createEthersWallet(WALLET_PRIVATE_KEY);

    console.log("🔄 Creating Lit Contracts Client...");
    const litContractsClient = await createLitContractsClient(ethersWallet, LIT_NETWORK);

    console.log("🔄 Minting Capacity Credit...");
    const capacityCredit = await mintCapacityCredit(litContractsClient, 10, 30);
    console.log(`ℹ️  Minted Capacity Credit with token id: ${capacityCredit.capacityTokenId}`);

    console.log("🔄 Minting PKP...");
    const pkp = await mintPKP(litContractsClient);
    console.log(`ℹ️  Minted PKP with public key: ${JSON.stringify(pkp, null, 2)}`);

    console.log("🔄 Getting PKP Session Sigs...");
    const pkpSessionSigs = await getPKPSessionSigs(
        litNodeClient,
        pkp.publicKey,
        pkp.ethAddress,
        ethersWallet,
        capacityCredit.capacityTokenId,
    );

    console.log("🔄 Generating Wrapped Key...");
    const wrappedKey = await generateWrappedKey(litNodeClient, pkpSessionSigs, "solana");

    console.log("🔄 Getting Wrapped Key Metadata...");
    const wrappedKeyMetadata = await getWrappedKeyMetadata(litNodeClient, pkpSessionSigs, wrappedKey.id);

    const transferAmount = LAMPORTS_PER_SOL / 100; // 0.01 SOL
    const fundingSolanaWallet = Keypair.fromSecretKey(
        ethers.utils.base58.decode(process.env.SOLANA_PRIVATE_KEY as string),
    );
    const solanaConnection = new Connection(clusterApiUrl("devnet"), "confirmed");

    console.log(
        `🔄 Using ${fundingSolanaWallet.publicKey.toBase58()} to send ${
            transferAmount / LAMPORTS_PER_SOL
        } SOL to ${wrappedKeyMetadata.publicKey} for transfer test...`,
    );
    const solanaTransaction = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: fundingSolanaWallet.publicKey,
            toPubkey: new PublicKey(wrappedKeyMetadata.publicKey),
            lamports: transferAmount,
        }),
    );
    const fundingSignature = await sendAndConfirmTransaction(solanaConnection, solanaTransaction, [
        fundingSolanaWallet,
    ]);
    console.log(`💰 Funded Wrapped Key tx signature: ${fundingSignature}`);

    console.log("ℹ️  Finished Lit Setup!");

    const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
    const litWallet = lit({
        litNodeClient,
        pkpSessionSigs,
        wrappedKeyMetadata,
        network: "solana",
        connection,
        chain: "devnet",
    });

    const prompt = await pull<ChatPromptTemplate>("hwchase17/structured-chat-agent");

    const tools = await getOnChainTools({
        wallet: litWallet,
        plugins: [sendSOL()],
    });

    const agent = await createStructuredChatAgent({
        llm,
        tools,
        prompt,
    });

    const agentExecutor = new AgentExecutor({
        agent,
        tools,
        // Enable this to see the agent's thought process
        // verbose: true,
    });

    const balanceResponse = await agentExecutor.invoke({
        input: "Get my balance in SOL",
    });

    console.log("Response:", balanceResponse);

    const transferPrompt = `Transfer ${transferAmount / LAMPORTS_PER_SOL / 10} SOL to ${wrappedKeyMetadata.publicKey}`;
    console.log(`🤖 Attempting to: ${transferPrompt}`);
    const transferResponse = await agentExecutor.invoke({
        input: transferPrompt,
    });

    console.log("Transfer Response:", transferResponse);
})();
