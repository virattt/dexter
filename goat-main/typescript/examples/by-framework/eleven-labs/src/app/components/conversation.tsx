"use client";

import { useConversation } from "@11labs/react";
import { getOnChainTools } from "@goat-sdk/adapter-eleven-labs";
import { useCallback } from "react";

import { isEthereumWallet } from "@dynamic-labs/ethereum";
import { DynamicWidget, useIsLoggedIn } from "@dynamic-labs/sdk-react-core";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { isSolanaWallet } from "@dynamic-labs/solana";

import { coingecko } from "@goat-sdk/plugin-coingecko";
import { sendETH } from "@goat-sdk/wallet-evm";
import { viem } from "@goat-sdk/wallet-viem";
import { createSolanaWalletFromDynamic } from "../utils";

export function Conversation() {
    const isLoggedIn = useIsLoggedIn();
    const { primaryWallet, sdkHasLoaded } = useDynamicContext();

    const isConnected = sdkHasLoaded && isLoggedIn && primaryWallet;

    const conversation = useConversation({
        onConnect: () => console.log("Connected"),
        onDisconnect: () => console.log("Disconnected"),
        onMessage: (message) => console.log("Message:", message),
        onError: (error) => console.error("Error:", error),
    });

    const startConversation = useCallback(async () => {
        try {
            // Request microphone permission
            await navigator.mediaDevices.getUserMedia({ audio: true });

            if (!primaryWallet) {
                throw new Error("Wallet not connected");
            }

            let tools = null;

            if (isSolanaWallet(primaryWallet)) {
                const connection = await primaryWallet.getConnection();
                const signer = await primaryWallet.getSigner();

                tools = await getOnChainTools({
                    wallet: createSolanaWalletFromDynamic(connection, signer),
                    plugins: [coingecko({ apiKey: process.env.NEXT_PUBLIC_COINGECKO_API_KEY ?? "" })],
                });
            } else if (isEthereumWallet(primaryWallet)) {
                tools = await getOnChainTools({
                    wallet: viem(await primaryWallet.getWalletClient()),
                    plugins: [sendETH(), coingecko({ apiKey: process.env.NEXT_PUBLIC_COINGECKO_API_KEY ?? "" })],
                    options: {
                        logTools: true,
                    },
                });
            } else {
                throw new Error("Unsupported wallet type");
            }

            if (!tools) {
                throw new Error("Failed to initialize tools");
            }

            console.log("tools", tools);

            // Start the conversation with your agent
            await conversation.startSession({
                agentId: process.env.NEXT_PUBLIC_ELEVEN_LABS_AGENT_ID ?? "",
                clientTools: tools,
            });
        } catch (error) {
            console.error("Failed to start conversation:", error);
        }
    }, [conversation, primaryWallet]);

    const stopConversation = useCallback(async () => {
        await conversation.endSession();
    }, [conversation]);

    if (!sdkHasLoaded) {
        return <div>Loading...</div>;
    }

    return (
        <div className="flex flex-col items-center gap-4">
            <h1 className="text-2xl font-bold">1. Connect Wallet to start</h1>
            <DynamicWidget />

            <h1 className="text-2xl font-bold">2. Start Conversation with Agent</h1>
            <div className="flex flex-col items-center gap-4">
                <div className="flex gap-2">
                    <button
                        onClick={startConversation}
                        disabled={conversation.status === "connected" || !isConnected}
                        className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
                        type="button"
                    >
                        Start Conversation
                    </button>
                    <button
                        onClick={stopConversation}
                        disabled={conversation.status !== "connected"}
                        className="px-4 py-2 bg-red-500 text-white rounded disabled:bg-gray-300"
                        type="button"
                    >
                        Stop Conversation
                    </button>
                </div>

                <div className="flex flex-col items-center">
                    <p>Status: {conversation.status}</p>
                    {conversation.status === "connected" && (
                        <p>Agent is {conversation.isSpeaking ? "speaking" : "listening"}</p>
                    )}
                </div>
            </div>
        </div>
    );
}
