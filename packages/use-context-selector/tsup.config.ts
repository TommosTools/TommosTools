import { defineConfig } from "tsup";
import type { Options } from "tsup";

export default defineConfig((options: Options) =>
	({
		entry: ["src/index.ts"],
		format: ["iife", "cjs", "esm"],
		esbuildOptions(options) {
			options.packages = "external";
		},
	}));
