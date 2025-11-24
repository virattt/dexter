import { http, createWalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

import { getTools } from "@goat-sdk/core";

import { crossmintHeadlessCheckout } from "@goat-sdk/plugin-crossmint-headless-checkout";
import { viem } from "@goat-sdk/wallet-viem";
import express from "express";
import swaggerUi from "swagger-ui-express";
import { zodToJsonSchema } from "zod-to-json-schema";

import type { JSONSchemaType } from "ajv";
import type { z } from "zod";
require("dotenv").config();

// 1. Create a wallet client
const account = privateKeyToAccount(process.env.WALLET_PRIVATE_KEY as `0x${string}`);

const walletClient = createWalletClient({
    account: account,
    transport: http(process.env.RPC_PROVIDER_URL),
    chain: base,
});

async function createRESTServer() {
    // 2. Get the tools
    const tools = (
        await getTools({
            wallet: viem(walletClient),
            plugins: [
                // if crossmint api key is provided, enable amazon purchase
                ...(process.env.CROSSMINT_API_KEY
                    ? [
                          crossmintHeadlessCheckout({
                              apiKey: process.env.CROSSMINT_API_KEY as string,
                          }),
                      ]
                    : []),
            ],
        })
    ).map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: zodToJsonSchema(tool.parameters, {
            target: "jsonSchema7",
        }) as JSONSchemaType<z.output<typeof tool.parameters>>,
        function: tool.execute,
    }));

    // 3. Create the REST server
    const app = express();
    app.use(express.json());

    // 3.1 Generate the OpenAPI specification
    const openApiSpec = {
        openapi: "3.1.0",
        info: {
            title: "GOAT Tools API",
            version: "1.0.0",
            description: "REST API for GOAT SDK tools",
        },
        servers: [
            {
                url: "https://a74e-176-84-227-121.ngrok-free.app",
            },
        ],
        // biome-ignore lint/suspicious/noExplicitAny: it can be any
        paths: {} as Record<string, any>,
        components: {
            schemas: {},
        },
    };

    // 3.2 Create REST endpoints for each tool
    for (const tool of tools) {
        const routePath = `/tools/${tool.name}`;
        const randomId = Math.floor(Math.random() * 10000);

        // Add path to OpenAPI spec
        openApiSpec.paths[routePath] = {
            post: {
                summary: tool.description,
                operationId: `execute${tool.name.charAt(0).toUpperCase() + tool.name.slice(1)}_${randomId}`,
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: tool.parameters.type,
                                properties: tool.parameters.properties,
                                required: tool.parameters.required ?? [],
                            },
                        },
                    },
                },
                responses: {
                    "200": {
                        description: "Successful operation",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "string",
                                },
                            },
                        },
                    },
                    "500": {
                        description: "Server error",
                    },
                },
            },
        };

        // Create the actual endpoint
        app.post(routePath, async (req: express.Request, res: express.Response) => {
            try {
                const result = await tool.function(req.body);
                res.json(result);
            } catch (error) {
                res.status(500).json({
                    error: error instanceof Error ? error.message : "Unknown error occurred",
                });
            }
        });
    }

    // 3.3 Add an endpoint to list all available tools with their parameters
    app.get("/tools", (_: express.Request, res: express.Response) => {
        const toolList = tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
            endpoint: `/tools/${tool.name}`,
        }));
        res.json(toolList);
    });

    // 3.4 Add OpenAPI spec endpoint
    app.get("/api-docs/openapi.json", (_: express.Request, res: express.Response) => {
        res.json(openApiSpec);
    });

    // 3.5 Add Swagger UI
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`\nREST Server running on port ${PORT}`);
        console.log("\nAvailable endpoints:");
        console.log("/tools - GET - List all available tools and their parameters");
        console.log("/api-docs - GET - OpenAPI documentation UI");
        console.log("/api-docs/openapi.json - GET - OpenAPI specification");

        for (const tool of tools) {
            console.log(`/tools/${tool.name} - POST - ${tool.description}`);
        }
    });
}

// 4. Start the REST server
createRESTServer()
    .then(() => {
        console.log("Ready...");
    })
    .catch((error) => {
        console.error("Error starting REST Server:", error);
    });
