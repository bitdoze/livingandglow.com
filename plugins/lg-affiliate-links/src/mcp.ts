import type { PluginContext, SandboxedRouteContext } from "emdash/plugin";

import {
	isValidDestination,
	isValidSlug,
	normalizeTags,
	slugify,
	ulid,
	MAX_CATEGORY_LENGTH,
	MAX_LABEL_LENGTH,
	MAX_NOTES_LENGTH,
	type LinkRecord,
} from "./types";

type RouteCtx = Pick<SandboxedRouteContext, "input">;

function publicPath(slug: string): string {
	return `/go/${encodeURIComponent(slug)}/`;
}

function str(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function linkOut(id: string, link: LinkRecord) {
	return {
		id,
		slug: link.slug,
		label: link.label,
		url: link.url,
		category: link.category,
		tags: link.tags,
		status: link.status,
		clickCount: link.clickCount,
		shortUrl: publicPath(link.slug),
		createdAt: link.createdAt,
		updatedAt: link.updatedAt,
	};
}

/** links_list — read-only listing, optionally filtered. */
export async function handleLinksList(routeCtx: RouteCtx, ctx: PluginContext) {
	const input = (routeCtx.input ?? {}) as Record<string, unknown>;
	const status = str(input.status);
	const query = str(input.query).toLowerCase();
	const limit = Math.min(Math.max(Number(input.limit) || 100, 1), 500);

	const { items } = await ctx.storage.links.query({
		where: status === "active" || status === "archived" ? { status } : {},
		orderBy: { createdAt: "desc" },
		limit: 500,
	});

	const links = items
		.map((row) => linkOut(row.id, row.data as LinkRecord))
		.filter(
			(link) =>
				!query ||
				link.slug.includes(query) ||
				link.label.toLowerCase().includes(query) ||
				link.url.toLowerCase().includes(query) ||
				link.category.toLowerCase().includes(query),
		)
		.slice(0, limit);

	return { ok: true, total: links.length, links };
}

/** links_save — create or update, upserted by slug. */
export async function handleLinksSave(routeCtx: RouteCtx, ctx: PluginContext) {
	const input = (routeCtx.input ?? {}) as Record<string, unknown>;
	const label = str(input.label).slice(0, MAX_LABEL_LENGTH);
	let slug = slugify(str(input.slug) || label);
	const url = str(input.url);
	const category = str(input.category).slice(0, MAX_CATEGORY_LENGTH);
	const tags = normalizeTags(
		Array.isArray(input.tags) ? input.tags : str(input.tags).split(",").map((t) => t.trim()),
	);
	const notes = str(input.notes).slice(0, MAX_NOTES_LENGTH);
	const status = input.status === "archived" ? "archived" : "active";

	if (!label) return { ok: false, error: "label is required" };
	if (!isValidSlug(slug)) return { ok: false, error: "slug must be lowercase letters, digits and dashes" };
	if (!isValidDestination(url)) return { ok: false, error: "url must be a valid http(s) URL" };

	const now = new Date().toISOString();
	const { items } = await ctx.storage.links.query({ where: { slug }, limit: 1 });
	const existing = items[0];

	if (existing) {
		const record = existing.data as LinkRecord;
		const next: LinkRecord = { ...record, label, slug, url, category, tags, notes, status, updatedAt: now };
		await ctx.storage.links.put(existing.id, next);
		return { ok: true, updated: true, ...linkOut(existing.id, next) };
	}

	const id = ulid();
	const record: LinkRecord = { slug, label, url, category, tags, notes, status, clickCount: 0, createdAt: now, updatedAt: now };
	await ctx.storage.links.put(id, record);
	return { ok: true, updated: false, ...linkOut(id, record) };
}

/** links_delete — removes the link and its click history. */
export async function handleLinksDelete(routeCtx: RouteCtx, ctx: PluginContext) {
	const input = (routeCtx.input ?? {}) as Record<string, unknown>;
	const slug = str(input.slug);
	if (!isValidSlug(slug)) return { ok: false, error: "slug must be lowercase letters, digits and dashes" };

	const { items } = await ctx.storage.links.query({ where: { slug }, limit: 1 });
	const row = items[0];
	if (!row) return { ok: false, error: `no link with slug "${slug}"` };

	for (;;) {
		const { items: clicks } = await ctx.storage.clicks.query({ where: { linkId: row.id }, limit: 100 });
		if (clicks.length === 0) break;
		await ctx.storage.clicks.deleteMany(clicks.map((item) => item.id));
	}
	await ctx.storage.links.delete(row.id);
	return { ok: true, deleted: true, slug };
}
