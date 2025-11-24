import { z } from "zod";

/**
 * Validates required environment variables and provides helpful error messages.
 * @param requiredVars Array of required environment variable names
 * @throws Error if any required variables are missing
 */
export const validateEnvVars = (requiredVars: string[]) => {
    const missing = requiredVars.filter((v) => !process.env[v]);
    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variables: ${missing.join(", ")}\nSee docs/environment-variables.mdx for setup instructions`,
        );
    }
};

/**
 * Common environment variable schemas for validation
 */
export const envSchemas = {
    openai: z.string().startsWith("sk-"),
    evmPrivateKey: z.string().startsWith("0x").length(66),
    solanaPrivateKey: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/),
    rpcUrl: z.string().url(),
    apiKey: z.string().min(32),
};

/**
 * Validates environment variables against predefined schemas
 * @param vars Object mapping environment variable names to their schema types
 * @throws Error if any variables fail validation
 */
export const validateEnvVarFormats = (vars: Record<string, keyof typeof envSchemas>) => {
    const errors: string[] = [];
    for (const [varName, schemaType] of Object.entries(vars)) {
        const value = process.env[varName];
        if (!value) continue; // Skip if not provided (handled by validateEnvVars)

        const result = envSchemas[schemaType].safeParse(value);
        if (!result.success) {
            errors.push(`Invalid format for ${varName}: ${result.error.message}`);
        }
    }
    if (errors.length > 0) {
        throw new Error(
            `Environment variable format validation failed:\n${errors.join("\n")}\nSee docs/environment-variables.mdx for correct formats`,
        );
    }
};
