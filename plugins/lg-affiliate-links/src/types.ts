import type { PluginContext } from "emdash/plugin";

export interface LinkRecord {
	slug: string;
	label: string;
	url: string;
	category: string;
	tags: string[];
	notes: string;
	status: "active" | "archived";
	clickCount: number;
	createdAt: string;
	updatedAt: string;
}

export interface ClickRecord {
	linkId: string;
	createdAt: string;
	refHost: string;
	ua: string;
	country: string;
}

export interface PluginSettings {
	logClicks: boolean;
	clickRetentionDays: number;
	dedupeClicks: boolean;
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_SLUG_LENGTH = 96;
export const MAX_LABEL_LENGTH = 160;
export const MAX_URL_LENGTH = 2048;
export const MAX_CATEGORY_LENGTH = 64;
export const MAX_TAGS = 20;
export const MAX_TAG_LENGTH = 40;
export const MAX_NOTES_LENGTH = 2000;
export const MAX_CLICK_UA_LENGTH = 200;

export const DEFAULT_SETTINGS: PluginSettings = {
	logClicks: true,
	clickRetentionDays: 90,
	dedupeClicks: true,
};

const DEDUPE_PREFIX = "dedupe:";
const DAY_MS = 864e5;

export async function readSettings(ctx: PluginContext): Promise<PluginSettings> {
	const entries = new Map((await ctx.settings.list()).map(({ key, value }) => [key, value]));
	return {
		logClicks: entries.get("logClicks") !== false,
		clickRetentionDays: clampInt(entries.get("clickRetentionDays"), 0, 3650, DEFAULT_SETTINGS.clickRetentionDays),
		dedupeClicks: entries.get("dedupeClicks") !== false,
	};
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
	const n = Number(value);
	if (!Number.isFinite(n)) return fallback;
	return Math.max(min, Math.min(max, Math.trunc(n)));
}

export function slugify(value: string): string {
	return value
		.toLowerCase()
		.trim()
		.replace(/['"]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, MAX_SLUG_LENGTH)
		.replace(/-+$/g, "");
}

/** Validates a stored slug — same rules the admin form applies. */
export function isValidSlug(slug: string): boolean {
	return slug.length > 0 && slug.length <= MAX_SLUG_LENGTH && SLUG_PATTERN.test(slug);
}

/** Affiliate destinations must be http(s) — no javascript:, data:, or relative tricks. */
export function isValidDestination(url: string): boolean {
	if (url.length === 0 || url.length > MAX_URL_LENGTH) return false;
	try {
		const parsed = new URL(url);
		return parsed.protocol === "https:" || parsed.protocol === "http:";
	} catch {
		return false;
	}
}

export function normalizeTags(input: unknown): string[] {
	if (!Array.isArray(input)) return [];
	const out: string[] = [];
	for (const item of input) {
		if (typeof item !== "string") continue;
		const tag = item.trim().toLowerCase().slice(0, MAX_TAG_LENGTH);
		if (tag && !out.includes(tag)) out.push(tag);
		if (out.length >= MAX_TAGS) break;
	}
	return out;
}

export function ulid(): string {
	const time = Date.now().toString(36).padStart(10, "0");
	const rand = new Uint8Array(10);
	crypto.getRandomValues(rand);
	let out = "";
	for (const byte of rand) out += byte.toString(36).padStart(2, "0");
	return `${time}${out}`.toUpperCase().replace(/[^A-Z0-9]/g, "X").slice(0, 26);
}

export function refHost(referer: string | null | undefined): string {
	if (!referer) return "";
	try {
		return new URL(referer).hostname.slice(0, 200);
	} catch {
		return "";
	}
}

export interface RequestMetaShape {
	ip: string | null;
	userAgent: string | null;
	referer: string | null;
	geo: { country: string | null; region: string | null; city: string | null } | null;
}

export function requestMeta(value: unknown): RequestMetaShape {
	const meta = (value ?? {}) as Partial<RequestMetaShape>;
	return {
		ip: typeof meta.ip === "string" ? meta.ip : null,
		userAgent: typeof meta.userAgent === "string" ? meta.userAgent : null,
		referer: typeof meta.referer === "string" ? meta.referer : null,
		geo:
			meta.geo && typeof meta.geo === "object"
				? {
						country: typeof meta.geo.country === "string" ? meta.geo.country : null,
						region: typeof meta.geo.region === "string" ? meta.geo.region : null,
						city: typeof meta.geo.city === "string" ? meta.geo.city : null,
					}
				: null,
	};
}

async function sha256Hex(input: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Returns true when this visitor already counted for this link today.
 * Uses a short-lived KV flag keyed by a hash of ip+ua+day — the IP is
 * hashed, never stored. Missing IP dedupes on UA only (best effort).
 */
export async function isDuplicateClick(ctx: PluginContext, linkId: string, meta: RequestMetaShape): Promise<boolean> {
	const dayBucket = Math.floor(Date.now() / DAY_MS);
	const fingerprint = await sha256Hex(`${linkId}|${meta.ip ?? ""}|${meta.userAgent ?? ""}|${dayBucket}`);
	const key = `${DEDUPE_PREFIX}${fingerprint}`;
	if (await ctx.kv.get(key)) return true;
	await ctx.kv.set(key, { createdAt: new Date().toISOString() });
	return false;
}

/** Hourly cron support: drop dedupe flags older than the current day bucket. */
export async function pruneDedupeFlags(ctx: PluginContext): Promise<void> {
	const dayBucket = Math.floor(Date.now() / DAY_MS);
	for (const { key } of await ctx.kv.list(DEDUPE_PREFIX)) {
		// Flags are pure hash keys — recompute age from stored timestamp.
		const row = await ctx.kv.get<{ createdAt?: string }>(key);
		const at = new Date(row?.createdAt ?? 0).getTime();
		if (!Number.isFinite(at) || Math.floor(at / DAY_MS) < dayBucket) await ctx.kv.delete(key);
	}
}
