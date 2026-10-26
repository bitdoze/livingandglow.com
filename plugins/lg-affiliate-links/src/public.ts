import type { PluginContext, SandboxedRouteContext } from "emdash/plugin";

import {
	isDuplicateClick,
	isValidSlug,
	readSettings,
	refHost,
	requestMeta,
	ulid,
	type ClickRecord,
	type LinkRecord,
} from "./types";

function queryParam(input: unknown, key: string): string {
	if (!input || typeof input !== "object") return "";
	const value = (input as Record<string, unknown>)[key];
	if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : "";
	return typeof value === "string" ? value : "";
}

async function findActiveLink(ctx: PluginContext, slug: string) {
	const { items } = await ctx.storage.links.query({
		where: { slug },
		limit: 1,
	});
	const row = items[0];
	if (!row) return null;
	const link = row.data as LinkRecord;
	if (link.status !== "active") return null;
	return { id: row.id, link };
}

/** Public: metadata for renderers — label only, never the destination URL. */
export async function handleResolveRoute(routeCtx: SandboxedRouteContext, ctx: PluginContext) {
	const slug = queryParam(routeCtx.input, "slug").trim();
	if (!isValidSlug(slug)) return { found: false };
	const found = await findActiveLink(ctx, slug);
	if (!found) return { found: false };
	return { found: true, slug: found.link.slug, label: found.link.label };
}

/**
 * Public: resolve a slug to its destination and record the click.
 * The site's /go/<slug> endpoint issues the actual HTTP redirect — public
 * plugin routes are not allowed to redirect off-origin.
 */
export async function handleGoRoute(routeCtx: SandboxedRouteContext, ctx: PluginContext) {
	const slug = queryParam(routeCtx.input, "slug").trim();
	if (!isValidSlug(slug)) return { found: false };
	const found = await findActiveLink(ctx, slug);
	if (!found) return { found: false };

	const settings = await readSettings(ctx);
	const meta = requestMeta(routeCtx.requestMeta);

	const duplicate = settings.dedupeClicks ? await isDuplicateClick(ctx, found.id, meta) : false;
	if (!duplicate) {
		// Denormalized counter — atomic increment even under concurrent clicks.
		await ctx.storage.links
			.updateIf(found.id, {
				where: {},
				delta: { clickCount: { inc: 1 } },
			})
			.catch((error) => ctx.log.warn("Click counter update failed", { error: String(error) }));

		if (settings.logClicks) {
			const click: ClickRecord = {
				linkId: found.id,
				createdAt: new Date().toISOString(),
				refHost: refHost(meta.referer),
				ua: (meta.userAgent ?? "").slice(0, 200),
				country: meta.geo?.country ?? "",
			};
			await ctx.storage.clicks
				.put(ulid(), click)
				.catch((error) => ctx.log.warn("Click log write failed", { error: String(error) }));
		}
	}

	return { found: true, url: found.link.url };
}
