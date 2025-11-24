import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

export class ModelInferenceParameters extends createToolParameters(
    z.object({
        modelCid: z.string().describe("CID of the model to run inference with"),
        inferenceMode: z.number().describe("Inference mode to use (0 for VANILLA, 1 for TEE)"),
        modelInput: z.record(z.any()).describe("Input to the model in the form of a JSON object"),
    }),
) {}

export class LLMCompletionParameters extends createToolParameters(
    z.object({
        modelCid: z.string().describe("CID of the LLM model to use"),
        inferenceMode: z.number().describe("Inference mode to use (0 for VANILLA, 1 for TEE)"),
        prompt: z.string().describe("Text prompt for the LLM"),
        maxTokens: z.number().default(100).describe("Maximum number of tokens to generate"),
        stopSequence: z.array(z.string()).default([]).describe("Sequences that will stop generation if encountered"),
        temperature: z.number().default(0).describe("Temperature for sampling (0.0 to 1.0)"),
    }),
) {}

export class LLMChatParameters extends createToolParameters(
    z.object({
        modelCid: z.string().describe("CID of the LLM model to use"),
        inferenceMode: z.number().describe("Inference mode to use (0 for VANILLA, 1 for TEE)"),
        messages: z
            .array(
                z.object({
                    role: z.enum(["system", "user", "assistant", "tool"]).describe("Role of the message sender"),
                    content: z.string().describe("Content of the message"),
                    toolCalls: z.array(z.any()).optional().describe("Tool calls made in this message"),
                    toolCallId: z.string().optional().describe("ID of the tool call this message is responding to"),
                    name: z.string().optional().describe("Name of the entity sending the message"),
                }),
            )
            .describe("Array of conversation messages"),
        maxTokens: z.number().default(100).describe("Maximum number of tokens to generate"),
        stopSequence: z.array(z.string()).default([]).describe("Sequences that will stop generation if encountered"),
        temperature: z.number().default(0).describe("Temperature for sampling (0.0 to 1.0)"),
        tools: z.array(z.any()).default([]).describe("Tools available to the model"),
        toolChoice: z.string().optional().describe("Tool choice strategy ('auto', 'none', or specific tool name)"),
    }),
) {}

export class ClientConfigParameters extends createToolParameters(
    z.object({
        privateKey: z.string().describe("Private key for authentication with OpenGradient"),
    }),
) {}
