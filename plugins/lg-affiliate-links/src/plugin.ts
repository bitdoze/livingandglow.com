import type { SandboxedPlugin } from "emdash/plugin";

import { handleAdminInteraction } from "./admin";
import { handleGoRoute, handleResolveRoute } from "./public";
import { pruneDedupeFlags, readSettings } from "./types";

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
