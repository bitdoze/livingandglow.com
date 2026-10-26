# lg-affiliate-links

Managed affiliate links for EmDash CMS: organize destination URLs once,
reference them by slug everywhere, and get click tracking with dedupe and
retention cleanup.

## What it provides

- **Admin UI** (Plugins → Affiliate links, Block Kit pages): create, edit,
  archive/reactivate and delete links; per-link and aggregate click stats
  with a 30-day chart; a setup guide page.
- **Link records**: slug, label, destination URL, category, tags, notes,
  status, denormalized click counter.
- **Click tracking**: individual click rows (time, referrer host, UA,
  country) plus per-link counters. Repeat clicks from the same visitor are
  deduplicated per link per day via a hashed IP+UA flag (IPs are never
  stored). An hourly cron prunes click rows older than the retention
  setting and clears stale dedupe flags.
- **Public routes**:
  - `GET /_emdash/api/plugins/lg-affiliate-links/resolve?slug=<slug>` —
    returns `{ found, slug, label }` for renderers. Never exposes the
    destination.
  - `GET /_emdash/api/plugins/lg-affiliate-links/go?slug=<slug>` — records
    the click and returns `{ found, url }`. Public plugin routes cannot
    redirect off-origin, so the site issues the redirect itself.
- **Settings** (Plugins → Affiliate links → Settings): `logClicks`,
  `dedupeClicks`, `clickRetentionDays`.

## Site integration

The `site/` directory ships the integration files — copy them into the
site (already done on livingandglow.com):

- `site/block-types/affiliate_link.json` — the `affiliate_link` block type
  (slug, optional anchor text, inline/button style). Register it via the
  schema API or `seed/seed.json` and add it to the `allowedTypes` of the
  `blocks` fields that should offer it.
- `site/components/AffiliateLink.astro` — the block renderer. Emits
  `/go/<slug>/` links with `target="_blank"` and
  `rel="sponsored nofollow noopener"` plus a visible "paid link" label.
- `site/affiliate-links.ts` — helpers (`affiliateHref`,
  `resolveAffiliateLink`) that call the plugin's public routes in-process
  via `Astro.locals.emdash.handlePublicPluginApiRoute`.
- `src/pages/go/[slug].ts` (site-side, not in `site/` by name) — the
  `/go/<slug>/` endpoint: calls the plugin `go` route, then 303s to the
  destination with `x-robots-tag: noindex, nofollow`.

## Storage

- `links` — one row per link (indexes: slug, status, category, createdAt,
  clickCount; unique slug).
- `clicks` — one row per logged click (indexes: linkId, createdAt,
  compound linkId+createdAt).

`where`/`orderBy` fields must be declared in `indexes` and match `data`
fields — the row's own `created_at` column is not queryable.
