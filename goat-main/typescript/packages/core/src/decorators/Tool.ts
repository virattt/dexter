import type { z } from "zod";
import { WalletClientBase } from "../classes";
import { snakeCase } from "../utils/snakeCase";

import "reflect-metadata";

/**
 * Parameters for the Tool decorator
 * @template TParameters - The Zod schema type for the tool parameters
 */
export type ToolDecoratorParams = {
    /**
     * The name of the tool
     * @default snakeCase(methodName)
     */
    name?: string;
    /** A description of what the tool does */
    description: string;
};

export type StoredToolMetadata = {
    name: string;
    description: string;
    parameters: {
        index: number;
        schema: z.ZodSchema;
    };
    walletClient?: {
        index: number;
    };
    // biome-ignore lint/complexity/noBannedTypes: Function is the correct type for a descriptor value
    target: Function;
};

export type StoredToolMetadataMap = Map<string, StoredToolMetadata>;

export const toolMetadataKey = Symbol("goat:tool");

/**
 * Decorator that marks a class method as a tool accessible to the LLM
 * @param params - Configuration parameters for the tool
 * @returns A decorator function that can be applied to class methods
 *
 * @example
 * class MyToolService {
 *     \@Tool({
 *         description: "Adds two numbers",
 *     })
 *     add({a, b}: AddParameters) {
 *         return a + b;
 *     }
 *}
 */
export function Tool(params: ToolDecoratorParams) {
    // biome-ignore lint/complexity/noBannedTypes: Object is the correct type for a class method
    return (target: Object, propertyKey: string, descriptor: PropertyDescriptor) => {
        const { parameters, walletClient } = validateMethodParameters(target, propertyKey);

        const existingTools: StoredToolMetadataMap =
            Reflect.getMetadata(toolMetadataKey, target.constructor) || new Map();

        existingTools.set(propertyKey, {
            target: descriptor.value,
            name: params.name ?? snakeCase(propertyKey),
            description: params.description,
            parameters: parameters,
            ...(walletClient ? { walletClient } : {}),
        });

        Reflect.defineMetadata(toolMetadataKey, existingTools, target.constructor);
        return target;
    };
}

function validateMethodParameters(
    // biome-ignore lint/complexity/noBannedTypes: Object is the correct type for a class method
    target: Object,
    propertyKey: string,
): {
    parameters: {
        index: number;
        schema: z.ZodSchema;
    };
    walletClient?: {
        index: number;
    };
} {
    const className = target instanceof Object ? target.constructor.name : undefined;
    const logPrefix = `Method '${propertyKey}'${className ? ` on class '${className}'` : ""}`;
    const explainer =
        "Tool methods must have at least one parameter that is a Zod schema class created with the createToolParameters function.";

    const methodParameters = Reflect.getMetadata("design:paramtypes", target, propertyKey);

    if (methodParameters == null) {
        throw new Error(`Failed to get parameters for ${logPrefix}.`);
    }
    if (methodParameters.length === 0) {
        throw new Error(`${logPrefix} has no parameters. ${explainer}`);
    }
    if (methodParameters.length > 2) {
        throw new Error(`${logPrefix} has ${methodParameters.length} parameters. ${explainer}`);
    }

    const parametersParameter = methodParameters.find(isParametersParameter);
    if (parametersParameter == null) {
        throw new Error(
            `${logPrefix} has no parameters parameter.\n\n1.) ${explainer}\n\n2.) Ensure that you are not using 'import type' for the parameters.`,
        );
    }

    const walletClientParameter = methodParameters.find(isWalletClientParameter);

    return {
        parameters: {
            index: methodParameters.indexOf(parametersParameter) as number,
            schema: parametersParameter.prototype.constructor.schema,
        },
        ...(walletClientParameter
            ? { walletClient: { index: methodParameters.indexOf(walletClientParameter) as number } }
            : {}),
    };
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
function isWalletClientParameter(param: any) {
    if (!param || !param.prototype) {
        return false;
    }
    if (param === WalletClientBase) {
        return true;
    }
    return param.prototype instanceof WalletClientBase;
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
function isParametersParameter(param: any) {
    return param.prototype?.constructor?.schema != null;
}
