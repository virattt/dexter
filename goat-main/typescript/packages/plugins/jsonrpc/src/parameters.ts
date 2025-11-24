import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

export class JSONRpcBodySchema extends createToolParameters(
    z.object({
        method: z.string().describe("A string containing the name of the method to be invoked"),
        params: z
            .array(z.string())
            .describe(
                "A structured value that holds the parameter value to be used during the invokation of the method",
            ),
        id: z.number().describe("An identifier established by the client that must contain a string number or null"),
        jsonrpc: z
            .string()
            .describe("A string that specifies the version of the JSON-RPC protocol must be exactly {{'2.0'}}"),
    }),
) {}
