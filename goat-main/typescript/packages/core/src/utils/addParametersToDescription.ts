import type { z } from "zod";

export function addParametersToDescription(description: string, schema: z.ZodTypeAny): string {
    let paramLines: string[] = [];

    if (schema._def?.typeName === "ZodObject") {
        const shape = schema._def.shape();
        if (shape) {
            paramLines = Object.entries<z.ZodTypeAny>(shape).map(([key, value]) => {
                const isOptional = value.isOptional();
                const paramDescription = value.description || "";
                const typeStr = getTypeString(value);
                return `- ${key}${isOptional ? " (optional)" : ""} (${typeStr}): ${paramDescription}`;
            });
        }
    }

    return `${description}\n${paramLines.join("\n")}`;
}

function getTypeString(schema: z.ZodTypeAny): string {
    const typeName = schema._def?.typeName;

    switch (typeName) {
        case "ZodOptional":
            return getTypeString((schema as z.ZodOptional<z.ZodTypeAny>).unwrap());
        case "ZodString":
            return "string";
        case "ZodNumber":
            return "number";
        case "ZodBoolean":
            return "boolean";
        case "ZodArray":
            return "array";
        case "ZodObject":
            return "object";
        default:
            return "unknown";
    }
}
