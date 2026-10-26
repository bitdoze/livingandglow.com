import type { APIContext } from "astro";

export const PLUGIN_ID = "lg-affiliate-links";

export interface AffiliateLinkInfo {
	found: boolean;
	slug?: string;
	label?: string;
}

const pending = new WeakMap<object, Map<string, Promise<AffiliateLinkInfo>>>();

/**
 * Public short URL for a managed link. The /go/<slug>/ endpoint records the
 * click through the plugin's public `go` route, then 303s to the destination.
 */
export function affiliateHref(slug: string): string {
	return `/go/${encodeURIComponent(slug)}/`;
}

/**
 * Resolve a link slug to its public metadata (label only — the destination
 * is never exposed to renderers). Cached per request across all blocks on
 * the page; resolve calls never count as clicks.
 */
export function resolveAffiliateLink(
	locals: APIContext["locals"],
	origin: string,
	slug: string,
): Promise<AffiliateLinkInfo> {
	let map = pending.get(locals);
	if (!map) {
		map = new Map();
		pending.set(locals, map);
	}
	let result = map.get(slug);
	if (!result) {
		result = callResolve(locals, origin, slug);
		map.set(slug, result);
	}
	return result;
}

async function callResolve(
	locals: APIContext["locals"],
	origin: string,
	slug: string,
): Promise<AffiliateLinkInfo> {
	const emdash = locals.emdash;
	if (!emdash?.handlePublicPluginApiRoute) return { found: false };
	try {
		const res = await emdash.handlePublicPluginApiRoute(
			PLUGIN_ID,
			"GET",
			"resolve",
			new Request(
				`${origin}/_emdash/api/plugins/${PLUGIN_ID}/resolve?slug=${encodeURIComponent(slug)}`,
			),
		);
		const data = res.success && res.data && typeof res.data === "object" ? res.data : null;
		if (!data || (data as AffiliateLinkInfo).found !== true) return { found: false };
		return data as AffiliateLinkInfo;
	} catch {
		return { found: false };
	}
}
