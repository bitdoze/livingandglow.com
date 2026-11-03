import type { SandboxedMcpTool, SandboxedPlugin } from "emdash/plugin";
import { z } from "zod";

import { handleAdminInteraction } from "./admin";
import { handleLinksDelete, handleLinksList, handleLinksSave } from "./mcp";
import { handleGoRoute, handleResolveRoute } from "./public";
import { pruneDedupeFlags, readSettings } from "./types";

const listInput = z
	.object({
		status: z.enum(["active", "archived"]).optional().describe("Filter by status"),
		query: z.string().optional().describe("Substring match on slug, label, destination URL or category"),
		limit: z.number().int().min(1).max(500).optional().describe("Max links returned (default 100)"),
	})
	.strict();

const saveInput = z
	.object({
		label: z.string().min(1).describe("Display label (e.g. product name)"),
		url: z.string().describe("Destination http(s) URL — usually the Amazon affiliate URL"),
		slug: z.string().optional().describe("Short-URL slug; derived from label when omitted"),
		category: z.string().optional().describe("Grouping category (e.g. Fashion, Beauty)"),
		tags: z.array(z.string()).optional().describe("Free-form tags"),
		notes: z.string().optional().describe("Internal notes"),
		status: z.enum(["active", "archived"]).optional().describe("active (default) or archived"),
	})
	.strict();

const deleteInput = z
	.object({
		slug: z.string().min(1).describe("Slug of the link to delete"),
	})
	.strict();

// The workspace hoists a second zod copy via @emdash-cms/auth, so the tool
// schema type differs structurally. Same runtime contract — cast once here.
const asToolInput = (schema: z.ZodType): SandboxedMcpTool["input"] =>
	schema as unknown as SandboxedMcpTool["input"];

const plugin: SandboxedPlugin = {
	routes: {
		// Public: metadata for renderers (label only — never the destination).
		resolve: {
			public: true,
			request: { body: "none" },
			handler: handleResolveRoute,
		},
		// Public: records the click and returns the destination. The site's
		// /go/<slug> endpoint performs the actual redirect, because public
		// plugin routes may not redirect off-origin.
		go: {
			public: true,
			request: { body: "none" },
			handler: handleGoRoute,
		},
		// Private: Block Kit admin pages.
		admin: {
			handler: handleAdminInteraction,
		},
		// Private JSON POST routes — these back the MCP tools declared in
		// emdash-plugin.jsonc (private + JSON body + permission = MCP eligible).
		links_list: {
			request: { body: "json" },
			permission: "content:read",
			handler: handleLinksList,
		},
		links_save: {
			request: { body: "json" },
			permission: "content:edit_any",
			handler: handleLinksSave,
		},
		links_delete: {
			request: { body: "json" },
			permission: "content:delete_any",
			handler: handleLinksDelete,
		},
	},
	mcp: {
		tools: {
			link_list: {
				description:
					"List managed affiliate links (slug, label, destination, category, tags, status, click count, /go/ short URL). Call this before inserting an affiliate_link block to find the right slug.",
				route: "links_list",
				input: asToolInput(listInput),
			},
			link_save: {
				description:
					"Create or update a managed affiliate link, upserted by slug (auto-derived from the label when omitted). The destination must be an http(s) URL. Returns the slug for affiliate_link blocks and the /go/ short URL.",
				route: "links_save",
				input: asToolInput(saveInput),
			},
			link_delete: {
				description:
					"Delete a managed affiliate link by slug, including its click history. Posts referencing its slug will no longer resolve.",
				route: "links_delete",
				input: asToolInput(deleteInput),
				destructive: true,
			},
		},
	},
	hooks: {
		"plugin:activate": async (_event, ctx) => {
			await ctx.cron?.schedule("prune", { schedule: "0 * * * *" });
		},
		"plugin:deactivate": async (_event, ctx) => {
			await ctx.cron?.cancel("prune").catch(() => {});
		},
		"plugin:uninstall": async (_event, ctx) => {
			await ctx.cron?.cancel("prune").catch(() => {});
		},
		cron: async (event, ctx) => {
			if (event.name !== "prune") return;
			await pruneDedupeFlags(ctx);
			const settings = await readSettings(ctx);
			if (settings.clickRetentionDays <= 0) return;
			const cutoff = new Date(Date.now() - settings.clickRetentionDays * 864e5).toISOString();
			for (;;) {
				const { items } = await ctx.storage.clicks.query({
					where: { createdAt: { lt: cutoff } },
					limit: 100,
				});
				if (items.length === 0) break;
				await ctx.storage.clicks.deleteMany(items.map((item) => item.id));
				ctx.log.info(`Pruned ${items.length} click rows older than ${settings.clickRetentionDays}d`);
			}
		},
	},
};

export default plugin;
