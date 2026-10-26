import { blocks, elements } from "@emdash-cms/blocks/server";
import type { Block, BlockResponse } from "@emdash-cms/blocks/server";
import type { PluginContext, SandboxedRouteContext } from "emdash/plugin";

import {
	isValidDestination,
	isValidSlug,
	normalizeTags,
	readSettings,
	slugify,
	ulid,
	MAX_CATEGORY_LENGTH,
	MAX_LABEL_LENGTH,
	MAX_NOTES_LENGTH,
	type LinkRecord,
} from "./types";

type Toast = NonNullable<BlockResponse["toast"]>;
const ok = (message: string): Toast => ({ message, type: "success" });
const fail = (message: string): Toast => ({ message, type: "error" });

function str(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function parseTagsInput(value: string): string[] {
	return value
		.split(",")
		.map((tag) => tag.trim())
		.filter(Boolean);
}

function rowMenu(actionId: string, items: Array<{ label: string; value: string }>) {
	return { type: "menu", action_id: actionId, label: "…", items, style: "secondary" } as const;
}

function publicPath(slug: string): string {
	return `/go/${encodeURIComponent(slug)}/`;
}

// ---------------------------------------------------------------------------
// /links — list, create, edit, delete

async function viewLinks(ctx: PluginContext, toast?: Toast): Promise<BlockResponse> {
	const { items } = await ctx.storage.links.query({
		orderBy: { createdAt: "desc" },
		limit: 100,
	});
	const links = items.map((row) => ({ id: row.id, ...(row.data as LinkRecord) }));
	const totalClicks = links.reduce((sum, link) => sum + (link.clickCount || 0), 0);
	const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
	const clicks7d = await ctx.storage.clicks.count({ createdAt: { gte: weekAgo } });

	const out: Block[] = [
		blocks.header("Affiliate links"),
		blocks.context(
			"Managed destination URLs with click tracking. Place them in posts with an Affiliate link block, or link to the short URL anywhere on the site.",
		),
		blocks.stats([
			{ label: "Links", value: links.length },
			{ label: "Active", value: links.filter((l) => l.status === "active").length },
			{ label: "Total clicks", value: totalClicks },
			{ label: "Clicks (7d)", value: clicks7d },
		]),
		blocks.actions([
			elements.button("new_link", "New link", { style: "primary" }),
			elements.link("Click stats", { kind: "plugin-page", path: "/stats" }, { appearance: "secondary" }),
			elements.link("Plugin settings", { kind: "plugin-settings" }, { appearance: "secondary" }),
		]),
	];

	if (links.length === 0) {
		out.push(
			blocks.empty({
				title: "No affiliate links yet",
				description:
					"Create your first link, then use its slug in an Affiliate link block inside a post or page.",
			}),
		);
		return { blocks: out, toast };
	}

	out.push(
		blocks.table({
			pageActionId: "links_page",
			columns: [
				{ key: "label", label: "Label" },
				{ key: "slug", label: "Slug", format: "code" },
				{ key: "category", label: "Category" },
				{ key: "clicks", label: "Clicks", format: "number" },
				{ key: "status", label: "Status", format: "badge" },
				{ key: "row", label: "", format: "element" },
			],
			rows: links.map((link) => ({
				label: link.label,
				slug: link.slug,
				category: link.category || "—",
				clicks: link.clickCount || 0,
				status: link.status,
				row: rowMenu("link_menu", [
					{ label: "Edit", value: `edit:${link.id}` },
					{ label: "Copy short URL", value: `copy:${link.id}` },
					{ label: link.status === "active" ? "Archive" : "Reactivate", value: `toggle:${link.id}` },
					{ label: "Stats", value: `stats:${link.id}` },
					{ label: "Delete", value: `ask_delete:${link.id}` },
				]),
			})),
		}),
	);
	return { blocks: out, toast };
}

function linkForm(link: (LinkRecord & { id?: string }) | null, categories: string[]): Block[] {
	const id = link?.id;
	return [
		blocks.header(id ? `Edit link — ${link?.label ?? ""}` : "New affiliate link"),
		blocks.context(
			"The short URL is derived from the slug. The destination is only ever reached through the redirect, which also records the click.",
		),
		blocks.form({
			blockId: "link_form",
			fields: [
				{
					type: "text_input",
					action_id: "label",
					label: "Label",
					placeholder: "CeraVe Moisturizing Cream",
					initial_value: link?.label ?? "",
				},
				{
					type: "text_input",
					action_id: "slug",
					label: "Slug",
					placeholder: "cerave-moisturizing-cream (auto from label if empty)",
					initial_value: link?.slug ?? "",
				},
				{
					type: "text_input",
					action_id: "url",
					label: "Destination URL",
					placeholder: "https://www.amazon.com/dp/…?tag=yourtag-20",
					initial_value: link?.url ?? "",
				},
				{
					type: "text_input",
					action_id: "category",
					label: "Category",
					placeholder: categories.length > 0 ? categories.slice(0, 5).join(", ") : "beauty",
					initial_value: link?.category ?? "",
				},
				{
					type: "text_input",
					action_id: "tags",
					label: "Tags",
					placeholder: "skincare, moisturizer — comma separated",
					initial_value: (link?.tags ?? []).join(", "),
				},
				{
					type: "text_input",
					action_id: "notes",
					label: "Notes",
					placeholder: "Internal notes — merchant, program, expiry…",
					multiline: true,
					initial_value: link?.notes ?? "",
				},
				{
					type: "select",
					action_id: "status",
					label: "Status",
					options: [
						{ label: "Active", value: "active" },
						{ label: "Archived (redirects stop working)", value: "archived" },
					],
					initial_value: link?.status ?? "active",
				},
			],
			submit: { label: id ? "Save changes" : "Create link", actionId: `save_link:${id ?? ""}` },
		}),
	];
}

async function viewLinkForm(ctx: PluginContext, id: string | null, toast?: Toast): Promise<BlockResponse> {
	let link: (LinkRecord & { id?: string }) | null = null;
	if (id) {
		const data = await ctx.storage.links.get(id);
		if (!data) return viewLinks(ctx, fail("Link not found"));
		link = { ...(data as LinkRecord), id };
	}
	const { items } = await ctx.storage.links.query({ limit: 100 });
	const categories = [...new Set(items.map((r) => (r.data as LinkRecord).category).filter(Boolean))].sort();
	return {
		blocks: [
			...linkForm(link, categories),
			blocks.actions([elements.button("back_links", "Back to links")]),
		],
		toast,
	};
}

async function saveLink(ctx: PluginContext, id: string, values: Record<string, unknown>): Promise<BlockResponse> {
	const label = str(values.label).slice(0, MAX_LABEL_LENGTH);
	let slug = slugify(str(values.slug) || label);
	const url = str(values.url);
	const category = str(values.category).slice(0, MAX_CATEGORY_LENGTH);
	const tags = normalizeTags(parseTagsInput(str(values.tags)));
	const notes = str(values.notes).slice(0, MAX_NOTES_LENGTH);
	const status = values.status === "archived" ? "archived" : "active";

	if (!label) return viewLinkForm(ctx, id || null, fail("Label is required"));
	if (!isValidSlug(slug)) return viewLinkForm(ctx, id || null, fail("Slug must be lowercase letters, digits and dashes"));
	if (!isValidDestination(url)) return viewLinkForm(ctx, id || null, fail("Destination must be a valid http(s) URL"));

	const existing = await ctx.storage.links.query({ where: { slug }, limit: 1 });
	if (existing.items.length > 0 && existing.items[0].id !== id) {
		return viewLinkForm(ctx, id || null, fail(`Slug "${slug}" is already used by another link`));
	}

	const now = new Date().toISOString();
	if (id) {
		const current = await ctx.storage.links.get(id);
		if (!current) return viewLinks(ctx, fail("Link not found"));
		const record = current as LinkRecord;
		await ctx.storage.links.put(id, {
			...record,
			label,
			slug,
			url,
			category,
			tags,
			notes,
			status,
			updatedAt: now,
		});
	} else {
		const record: LinkRecord = {
			slug,
			label,
			url,
			category,
			tags,
			notes,
			status,
			clickCount: 0,
			createdAt: now,
			updatedAt: now,
		};
		await ctx.storage.links.put(ulid(), record);
	}
	return viewLinks(ctx, ok(id ? "Link updated" : `Link created — ${publicPath(slug)}`));
}

async function toggleLink(ctx: PluginContext, id: string): Promise<BlockResponse> {
	const data = await ctx.storage.links.get(id);
	if (!data) return viewLinks(ctx, fail("Link not found"));
	const record = data as LinkRecord;
	const status = record.status === "active" ? "archived" : "active";
	await ctx.storage.links.put(id, { ...record, status, updatedAt: new Date().toISOString() });
	return viewLinks(ctx, ok(status === "active" ? "Link reactivated" : "Link archived"));
}

async function viewDeleteConfirm(ctx: PluginContext, id: string): Promise<BlockResponse> {
	const data = await ctx.storage.links.get(id);
	if (!data) return viewLinks(ctx, fail("Link not found"));
	const link = data as LinkRecord;
	return {
		blocks: [
			blocks.header(`Delete — ${link.label}`),
			blocks.banner({
				variant: "alert",
				title: "This cannot be undone",
				description: `The short URL ${publicPath(link.slug)} will stop redirecting and the click history is removed. Existing blocks that reference this slug will render as missing.`,
			}),
			blocks.actions([
				elements.button(`delete:${id}`, "Delete link", {
					style: "danger",
					confirm: {
						title: `Delete "${link.label}"?`,
						text: "The link and its click history will be permanently removed.",
						confirm: "Delete",
						deny: "Cancel",
						style: "danger",
					},
				}),
				elements.button("back_links", "Keep it"),
			]),
		],
	};
}

async function deleteLink(ctx: PluginContext, id: string): Promise<BlockResponse> {
	const data = await ctx.storage.links.get(id);
	if (!data) return viewLinks(ctx, fail("Link not found"));
	// Remove click rows too — no orphans. Bounded per page.
	for (;;) {
		const { items } = await ctx.storage.clicks.query({ where: { linkId: id }, limit: 100 });
		if (items.length === 0) break;
		await ctx.storage.clicks.deleteMany(items.map((item) => item.id));
	}
	await ctx.storage.links.delete(id);
	return viewLinks(ctx, ok("Link and its click history deleted"));
}

function copyUrlView(slug: string): BlockResponse {
	return {
		blocks: [
			blocks.header("Short URL"),
			blocks.section(`Share or embed this URL anywhere — it redirects and counts clicks.`),
			blocks.code({ code: publicPath(slug), language: "bash" }),
			blocks.context(
				"In posts and pages, prefer the Affiliate link block — enter this slug and it renders a labelled, tracked link automatically.",
			),
			blocks.actions([elements.button("back_links", "Back to links")]),
		],
	};
}

// ---------------------------------------------------------------------------
// /stats — aggregate + per-link drilldown

async function viewStats(ctx: PluginContext, linkId?: string): Promise<BlockResponse> {
	const [{ items: linkRows }, totalClicks] = await Promise.all([
		ctx.storage.links.query({ orderBy: { clickCount: "desc" }, limit: 100 }),
		ctx.storage.clicks.count(),
	]);
	const links = linkRows.map((row) => ({ id: row.id, ...(row.data as LinkRecord) }));

	const out: Block[] = [
		blocks.header("Click stats"),
		blocks.stats([
			{ label: "Total clicks", value: links.reduce((s, l) => s + (l.clickCount || 0), 0) },
			{ label: "Logged click rows", value: totalClicks },
			{ label: "Links", value: links.length },
		]),
		blocks.actions([elements.button("back_links", "Back to links")]),
	];

	if (linkId) {
		const link = links.find((l) => l.id === linkId);
		if (!link) return { blocks: [...out, blocks.banner({ variant: "error", title: "Link not found" })] };
		out.push(
			blocks.header(`Stats — ${link.label}`),
			blocks.fields([
				{ label: "Short URL", value: publicPath(link.slug) },
				{ label: "Destination", value: link.url },
				{ label: "Clicks (all time)", value: String(link.clickCount || 0) },
			]),
		);
		const { items: recent } = await ctx.storage.clicks.query({
			where: { linkId },
			orderBy: { createdAt: "desc" },
			limit: 25,
		});
		out.push(
			recent.length === 0
				? blocks.context("No logged clicks for this link yet.")
				: blocks.table({
						pageActionId: "link_clicks_page",
						columns: [
							{ key: "at", label: "When", format: "relative_time" },
							{ key: "ref", label: "Referrer" },
							{ key: "country", label: "Country" },
							{ key: "ua", label: "User agent" },
						],
						rows: recent.map((row) => {
							const click = row.data as { createdAt?: string; refHost?: string; country?: string; ua?: string };
							return {
								at: click.createdAt ?? "",
								ref: click.refHost || "—",
								country: click.country || "—",
								ua: (click.ua ?? "").slice(0, 60),
							};
						}),
					}),
		);
		return { blocks: out };
	}

	// 30-day clicks-per-day series for the chart.
	const dayMs = 864e5;
	const since = new Date(Date.now() - 29 * dayMs);
	since.setUTCHours(0, 0, 0, 0);
	const buckets = new Map<number, number>();
	for (let d = 0; d < 30; d++) buckets.set(since.getTime() + d * dayMs, 0);
	let cursor: string | undefined;
	for (;;) {
		const { items, cursor: next, hasMore } = await ctx.storage.clicks.query({
			where: { createdAt: { gte: since.toISOString() } },
			orderBy: { createdAt: "asc" },
			limit: 100,
			...(cursor ? { cursor } : {}),
		});
		for (const row of items) {
			const at = new Date((row.data as { createdAt?: string }).createdAt ?? 0);
			at.setUTCHours(0, 0, 0, 0);
			const key = at.getTime();
			if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
		}
		if (!hasMore || !next) break;
		cursor = next;
	}

	out.push(
		blocks.timeseriesChart({
			series: [
				{
					name: "Clicks",
					data: [...buckets.entries()].map(([ts, n]) => [ts, n] as [number, number]),
				},
			],
			xAxisName: "Day",
			yAxisName: "Clicks",
			style: "bar",
			height: 260,
		}),
	);

	if (links.length > 0) {
		out.push(
			blocks.table({
				pageActionId: "stats_links_page",
				columns: [
					{ key: "label", label: "Link" },
					{ key: "category", label: "Category" },
					{ key: "clicks", label: "Clicks", format: "number" },
					{ key: "row", label: "", format: "element" },
				],
				rows: links.slice(0, 25).map((link) => ({
					label: link.label,
					category: link.category || "—",
					clicks: link.clickCount || 0,
					row: rowMenu("stats_menu", [
						{ label: "Per-link stats", value: `stats:${link.id}` },
						{ label: "Edit", value: `edit:${link.id}` },
					]),
				})),
			}),
		);
	}
	return { blocks: out };
}

// ---------------------------------------------------------------------------
// /setup — how to use the plugin

function viewSetup(): BlockResponse {
	return {
		blocks: [
			blocks.header("Setup guide"),
			blocks.section(
				"Affiliate links are stored here once and referenced everywhere by slug — update a destination in one place and every post points at the new URL.",
			),
			blocks.header("1. Create links"),
			blocks.section(
				"Add links under Affiliate links. Each gets a short slug, a category and tags for organization, and a destination URL (your Amazon Associates or other affiliate URL).",
			),
			blocks.header("2. Place them in posts"),
			blocks.section(
				"In any post or page body, insert an Affiliate link block and enter the link's slug. It renders a labelled, tracked link that opens in a new tab with the required paid-link labeling.",
			),
			blocks.code({
				code: `Block type: affiliate_link\nFields:\n  slug  — the link's slug (required)\n  text  — optional custom anchor text\n  style — inline or button`,
				language: "bash",
			}),
			blocks.header("3. Or link directly"),
			blocks.section("Anywhere you can write a URL, use the short form — it redirects and counts the click:"),
			blocks.code({ code: "/go/<slug>/", language: "bash" }),
			blocks.context(
				"Clicks are de-duplicated per visitor per link per day. Individual click rows are pruned after the retention window set in plugin settings.",
			),
			blocks.actions([elements.button("new_link", "Create a link", { style: "primary" })]),
		],
	};
}

// ---------------------------------------------------------------------------

interface AdminInteraction {
	type: string;
	page?: string;
	action_id?: string;
	block_id?: string;
	value?: unknown;
	values?: Record<string, unknown>;
}

export async function handleAdminInteraction(routeCtx: SandboxedRouteContext, ctx: PluginContext) {
	const interaction = (routeCtx.input ?? {}) as AdminInteraction;
	try {
		if (interaction.type === "form_submit") {
			const action = interaction.action_id ?? "";
			if (action.startsWith("save_link:")) {
				return await saveLink(ctx, action.slice("save_link:".length), interaction.values ?? {});
			}
			return { blocks: [blocks.banner({ variant: "error", title: "Unknown form" })] };
		}

		if (interaction.type === "block_action") {
			// Menu elements put the item verb in `value`; plain buttons use
			// `action_id`. Table pagination fires its pageActionId.
			const action =
				typeof interaction.value === "string" && interaction.value.includes(":")
					? interaction.value
					: (interaction.action_id ?? "");
			const [verb, id] = action.split(":", 2);
			switch (verb) {
				case "new_link":
					return viewLinkForm(ctx, null);
				case "edit":
					return id ? viewLinkForm(ctx, id) : viewLinks(ctx);
				case "copy": {
					if (!id) return viewLinks(ctx);
					const data = await ctx.storage.links.get(id);
					return data ? copyUrlView((data as LinkRecord).slug) : viewLinks(ctx, fail("Link not found"));
				}
				case "toggle":
					return id ? toggleLink(ctx, id) : viewLinks(ctx);
				case "ask_delete":
					return id ? viewDeleteConfirm(ctx, id) : viewLinks(ctx);
				case "delete":
					return id ? deleteLink(ctx, id) : viewLinks(ctx);
				case "stats":
					return viewStats(ctx, id || undefined);
				case "back_links":
				case "links_page":
					return viewLinks(ctx);
				case "stats_links_page":
				case "link_clicks_page":
					return viewStats(ctx);
				default:
					return viewLinks(ctx);
			}
		}

		if (interaction.type === "page_load") {
			switch (interaction.page) {
				case "/stats":
					return viewStats(ctx);
				case "/setup":
					return viewSetup();
				case "/links":
				default:
					return viewLinks(ctx);
			}
		}

		return { blocks: [blocks.banner({ variant: "error", title: "Unknown interaction" })] };
	} catch (error) {
		ctx.log.error("Admin interaction failed", { error: error instanceof Error ? error.message : String(error) });
		return {
			blocks: [
				blocks.banner({
					variant: "error",
					title: "Something went wrong",
					description: "The action failed. Check the server log for details.",
				}),
			],
		};
	}
}
