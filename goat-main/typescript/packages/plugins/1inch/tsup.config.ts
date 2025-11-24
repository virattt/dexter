import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts", "src/balance.service.ts", "src/parameters.ts", "src/types.ts"],
    format: ["esm", "cjs"],
    dts: true,
    splitting: true,
    sourcemap: true,
    clean: true,
    target: "es2022",
});
