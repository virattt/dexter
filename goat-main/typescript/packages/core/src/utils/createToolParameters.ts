import type { z } from "zod";

export type ToolParametersStatic<T extends z.ZodSchema> = {
    new (): z.infer<T>;
    schema: T;
};

export function createToolParameters<T extends z.ZodSchema>(schema: T) {
    // biome-ignore lint/complexity/noStaticOnlyClass: this is a semi-hack to get the schema into the class
    class SchemaHolder {
        static schema = schema;
    }
    return SchemaHolder as ToolParametersStatic<T>;
}
