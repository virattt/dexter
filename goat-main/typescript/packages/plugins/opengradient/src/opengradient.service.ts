import { Tool } from "@goat-sdk/core";
import { WalletClientBase } from "@goat-sdk/core";
import { Client } from "opengradient-sdk";
import { LLMChatParameters, LLMCompletionParameters, ModelInferenceParameters } from "./parameters";
import { OpenGradientConfig } from "./types";

export class OpengradientService {
    private client: Client | null = null;

    constructor(private config: OpenGradientConfig) {}

    private getClient(clientConfig: OpenGradientConfig): Client {
        if (!this.client) {
            this.client = new Client({
                privateKey: clientConfig.privateKey,
            });
        }
        return this.client;
    }

    @Tool({
        name: "opengradient_model_inference",
        description: "Run inference on a machine learning model using OpenGradient",
    })
    async runModelInference(walletClient: WalletClientBase, parameters: ModelInferenceParameters) {
        const client = this.getClient(this.config);
        const [txHash, modelOutput] = await client.infer(
            parameters.modelCid,
            parameters.inferenceMode,
            parameters.modelInput,
        );

        return {
            transactionHash: txHash,
            output: modelOutput,
        };
    }

    @Tool({
        name: "opengradient_llm_completion",
        description: "Generate text completions using an LLM through OpenGradient",
    })
    async runLLMCompletion(walletClient: WalletClientBase, parameters: LLMCompletionParameters) {
        const client = this.getClient(this.config);
        const [txHash, completion] = await client.llmCompletion(
            parameters.modelCid,
            parameters.inferenceMode,
            parameters.prompt,
            parameters.maxTokens,
            parameters.stopSequence,
            parameters.temperature,
        );

        return {
            transactionHash: txHash,
            completion,
        };
    }

    @Tool({
        name: "opengradient_llm_chat",
        description: "Interact with an LLM using a chat interface through OpenGradient",
    })
    async runLLMChat(walletClient: WalletClientBase, parameters: LLMChatParameters) {
        const client = this.getClient(this.config);
        const [txHash, finishReason, message] = await client.llmChat(
            parameters.modelCid,
            parameters.inferenceMode,
            parameters.messages,
            parameters.maxTokens,
            parameters.stopSequence,
            parameters.temperature,
            parameters.tools,
            parameters.toolChoice,
        );

        return {
            transactionHash: txHash,
            finishReason,
            message,
        };
    }
}
