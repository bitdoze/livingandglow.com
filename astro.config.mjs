import node from "@astrojs/node";
import react from "@astrojs/react";
import { defineConfig, fontProviders } from "astro/config";
import emdash, { local, s3 } from "emdash/astro";
import { postgres, sqlite } from "emdash/db";
import { lgBlocksPlugin } from "lg-blocks";

const database = process.env.DATABASE_URL
	? postgres({ connectionString: process.env.DATABASE_URL })
	: sqlite({ url: "file:./data.db" });

const storage = process.env.S3_ENDPOINT
	? s3()
	: local({ directory: "./uploads", baseUrl: "/_emdash/api/media/file" });

export default defineConfig({
	output: "server",
	server: {
		host: "0.0.0.0",
		port: 4321,
	},
	adapter: node({
		mode: "standalone",
	}),
	security: {
		allowedDomains: [
			{ hostname: "livingandglow.com" },
			{ hostname: "www.livingandglow.com" },
		],
	},
	image: {
		layout: "constrained",
		responsiveStyles: true,
	},
	integrations: [
		react(),
		emdash({
			database,
			storage,
			plugins: [lgBlocksPlugin()],
		}),
	],
	fonts: [
		{
			provider: fontProviders.google(),
			name: "Inter",
			cssVariable: "--font-body",
			weights: [400, 500, 600, 700],
			fallbacks: ["sans-serif"],
		},
		{
			provider: fontProviders.google(),
			name: "Fraunces",
			cssVariable: "--font-fraunces",
			weights: [400, 500, 600, 700],
			styles: ["normal", "italic"],
			fallbacks: ["Georgia", "serif"],
		},
		{
			provider: fontProviders.google(),
			name: "JetBrains Mono",
			cssVariable: "--font-mono",
			weights: [400, 500],
			fallbacks: ["monospace"],
		},
	],
	devToolbar: { enabled: false },
});
