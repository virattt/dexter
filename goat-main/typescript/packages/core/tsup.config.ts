import { defineConfig } from "tsup";
import { treeShakableConfig } from "../../tsup.config.base";

export default defineConfig({
    ...treeShakableConfig,
});
