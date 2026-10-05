import node from "@astrojs/node";
import react from "@astrojs/react";
import { defineConfig, fontProviders } from "astro/config";
import emdash, { local, s3 } from "emdash/astro";
import { postgres, sqlite } from "emdash/db";
import { lgBlocksPlugin } from "lg-blocks";

// Adapter selection happens at build time (descriptors are baked into the
// bundle), so Docker builds set EMDASH_DB=postgres / EMDASH_STORAGE=s3 as
// non-secret build args. The connection string itself resolves at runtime:
// DATABASE_URL for migrations, and pg's PG* env fallback for the pool when
// connectionString is absent.
const usePostgres =
	process.env.EMDASH_DB === "postgres" || !!process.env.DATABASE_URL;
const database = usePostgres
	? postgres({ connectionString: process.env.DATABASE_URL })
	: sqlite({ url: "file:./data.db" });

const storage =
	process.env.EMDASH_STORAGE === "s3" || process.env.S3_ENDPOINT
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
		// Authorize media hosts so <Image> goes through the sharp transform
		// endpoint (webp/avif + srcset) instead of passing the raw file through.
		remotePatterns: [
			{ protocol: "https", hostname: "livingandglow.com" },
			{ protocol: "https", hostname: "www.livingandglow.com" },
			{ protocol: "https", hostname: "**.b-cdn.net" },
			{ protocol: "http", hostname: "localhost" },
			{ protocol: "http", hostname: "127.0.0.1" },
		],
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
