import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["./src/**"],
    format: "esm",
    splitting: false,
    sourcemap: true,
    clean: true,
    bundle: false,
    platform: "node",
    dts: true,
});
