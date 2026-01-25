import { DynamicStructuredTool } from '@langchain/core/tools';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { z, type ZodTypeAny } from 'zod';
import type { MCPClient } from './client.js';
import type { MCPToolDefinition } from './types.js';
import { formatToolResult } from '../tools/types.js';

type JSONSchemaProperty = {
  type?: string | string[];
  description?: string;
  enum?: unknown[];
  items?: JSONSchemaProperty;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  default?: unknown;
  [key: string]: unknown;
};

/**
 * Convert a JSON Schema type to a Zod schema
 */
function jsonSchemaTypeToZod(schema: JSONSchemaProperty): ZodTypeAny {
  // Handle arrays of types (e.g., ["string", "null"])
  const type = Array.isArray(schema.type)
    ? schema.type.find(t => t !== 'null') || 'string'
    : schema.type;

  const isNullable = Array.isArray(schema.type) && schema.type.includes('null');

  let zodSchema: ZodTypeAny;

  // Handle enum
  if (schema.enum && Array.isArray(schema.enum)) {
    const enumValues = schema.enum as [string, ...string[]];
    zodSchema = z.enum(enumValues.map(String) as [string, ...string[]]);
  } else {
    switch (type) {
      case 'string':
        zodSchema = z.string();
        break;
      case 'number':
      case 'integer':
        zodSchema = z.number();
        break;
      case 'boolean':
        zodSchema = z.boolean();
        break;
      case 'array':
        if (schema.items) {
          zodSchema = z.array(jsonSchemaTypeToZod(schema.items));
        } else {
          zodSchema = z.array(z.unknown());
        }
        break;
      case 'object':
        if (schema.properties) {
          const shape: Record<string, ZodTypeAny> = {};
          const requiredProps = new Set(schema.required || []);

          for (const [key, propSchema] of Object.entries(schema.properties)) {
            let propZod = jsonSchemaTypeToZod(propSchema);
            if (propSchema.description) {
              propZod = propZod.describe(propSchema.description);
            }
            if (!requiredProps.has(key)) {
              propZod = propZod.optional();
            }
            shape[key] = propZod;
          }
          zodSchema = z.object(shape);
        } else {
          zodSchema = z.record(z.string(), z.unknown());
        }
        break;
      case 'null':
        zodSchema = z.null();
        break;
      default:
        zodSchema = z.unknown();
    }
  }

  // Apply nullable if needed
  if (isNullable) {
    zodSchema = zodSchema.nullable();
  }

  // Apply description if present
  if (schema.description) {
    zodSchema = zodSchema.describe(schema.description);
  }

  return zodSchema;
}

/**
 * Convert a JSON Schema object to a Zod object schema
 */
export function jsonSchemaToZod(inputSchema: MCPToolDefinition['inputSchema']): z.ZodObject<Record<string, ZodTypeAny>> {
  const shape: Record<string, ZodTypeAny> = {};
  const requiredProps = new Set(inputSchema.required || []);

  if (inputSchema.properties) {
    for (const [key, propSchema] of Object.entries(inputSchema.properties)) {
      const prop = propSchema as JSONSchemaProperty;
      let propZod = jsonSchemaTypeToZod(prop);
      if (!requiredProps.has(key)) {
        propZod = propZod.optional();
      }
      shape[key] = propZod;
    }
  }

  return z.object(shape);
}

/**
 * Convert an MCP tool to a LangChain DynamicStructuredTool
 * Tool names are prefixed with mcp_{serverName}_ to avoid conflicts
 */
export function mcpToolToLangChain(
  serverName: string,
  tool: MCPToolDefinition,
  client: MCPClient
): StructuredToolInterface {
  const prefixedName = `mcp_${serverName}_${tool.name}`;

  return new DynamicStructuredTool({
    name: prefixedName,
    description: tool.description || `MCP tool: ${tool.name} from ${serverName}`,
    schema: jsonSchemaToZod(tool.inputSchema),
    func: async (input) => {
      try {
        const result = await client.callTool(tool.name, input);
        // Format result using existing formatToolResult for consistency
        return formatToolResult(result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return formatToolResult({ error: errorMessage });
      }
    },
  });
}
