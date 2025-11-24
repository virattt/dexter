import type { Options } from "tsup";

declare const process: {
    env: {
        NODE_ENV: string;
    };
};

export const treeShakableConfig: Options = {
    splitting: true,
    clean: true,
    format: ["esm", "cjs"],
    bundle: true,
    skipNodeModulesBundle: true,
    watch: false,
    shims: true,
    entry: ["src/**/*.(ts|tsx)", "!src/**/*.test.(ts|tsx)"],
    outDir: "dist",
    dts: true,
    minify: process.env.NODE_ENV === "production",
    sourcemap: process.env.NODE_ENV !== "production",
    // onSuccess: "tsc --emitDeclarationOnly --declaration --declarationMap --outDir dist && tsc-alias --outDir dist",
};
