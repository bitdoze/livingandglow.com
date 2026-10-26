import type { APIRoute } from "astro";
import { PLUGIN_ID } from "../../lib/affiliate-links";

const notFound = () =>
	new Response("Not found", {
		status: 404,
		headers: { "content-type": "text/plain; charset=utf-8" },
	});

/**
 * GET /go/<slug>/ — records the click through the affiliate plugin's public
 * `go` route and 303s to the stored destination. Public plugin routes cannot
 * redirect off-origin, so the redirect happens here in trusted site code.
 */
export const GET: APIRoute = async ({ params, locals, request }) => {
	const slug = (params.slug ?? "").trim();
	const emdash = locals.emdash;
	if (!slug || !emdash?.handlePublicPluginApiRoute) return notFound();

	const origin = new URL(request.url).origin;
	const target = new URL(`${origin}/_emdash/api/plugins/${PLUGIN_ID}/go`);
	target.searchParams.set("slug", slug);

	// Forward client context so the click row keeps referrer/user-agent/IP.
	const inner = new Request(target, { headers: request.headers });

	const res = await emdash.handlePublicPluginApiRoute(PLUGIN_ID, "GET", "go", inner);
	const data = res.success && res.data && typeof res.data === "object" ? res.data : null;
	const url =
		data && (data as { found?: boolean }).found === true && typeof (data as { url?: unknown }).url === "string"
			? (data as { url: string }).url
			: null;
	if (!url) return notFound();

	return new Response(null, {
		status: 303,
		headers: {
			location: url,
			"x-robots-tag": "noindex, nofollow",
			"cache-control": "private, no-store",
		},
	});
};
