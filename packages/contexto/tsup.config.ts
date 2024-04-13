import { defineConfig } from "tsup";
import type { Options } from "tsup";

export default defineConfig((options: Options) =>
	{
		// Supported values are 'dom' and 'native'
		const targetPlatform = options.env.targetPlatform;

		const outDir = `dist/${targetPlatform}`;
		const format = (targetPlatform === "dom") ? ["iife", "cjs", "esm"] : ["cjs"];

		const config: Options = {
			entry: ["src/index.ts"],
			external: ["react", "react-dom", "react-native"],
			esbuildOptions(options) {
				options.logOverride = { "import-is-undefined": "info" };
				options.packages = "external";
			},
			format,
			outDir,
		};

		return config;
	});
