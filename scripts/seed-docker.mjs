/**
 * Apply seed/seed.json to the Postgres database, including content
 * (posts, pages, bylines, terms) and $media downloads into local storage.
 *
 * Usage inside the app container:
 *   docker compose exec app node /app/scripts/seed-docker.mjs
 * or from the host after `docker cp`:
 *   docker cp scripts/ livingandglow:/app/
 *
 * The app container must have started once first so migrations have run.
 */
import { readFile } from "node:fs/promises";
import { Kysely } from "kysely";
import { createDialect } from "emdash/db/postgres";
import { createStorage as createLocalStorage } from "emdash/storage/local";
import { applySeed, validateSeed } from "emdash/seed";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
	console.error("DATABASE_URL is not set");
	process.exit(1);
}

const seed = JSON.parse(await readFile("/app/seed/seed.json", "utf8"));

const validation = validateSeed(seed);
if (!validation.valid) {
	console.error("Seed validation failed:", validation.errors);
	process.exit(1);
}
for (const w of validation.warnings) console.warn("warning:", w);

const db = new Kysely({
	dialect: createDialect({ connectionString, pool: { min: 0, max: 2 } }),
});

const storage = process.env.S3_ENDPOINT
	? (await import("emdash/storage/s3")).createStorage({})
	: createLocalStorage({
			directory: "/app/uploads",
			baseUrl: "/_emdash/api/media/file",
		});

const result = await applySeed(db, seed, {
	includeContent: true,
	onConflict: "update",
	storage,
});

console.log("Seed applied:", JSON.stringify(result, null, 2));
await db.destroy();
