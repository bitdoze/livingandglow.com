This is an EmDash site -- a CMS built on Astro with a full admin UI.

## Commands

```bash
npm run dev              # Start the Astro dev server
npx emdash types      # Regenerate TypeScript types from a running site
```

The admin UI is at `http://localhost:4321/_emdash/admin`.

## Key Files

| File                     | Purpose                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------- |
| `astro.config.mjs`       | Astro config with `emdash()` integration, database, and storage                    |
| `src/live.config.ts`     | EmDash loader registration (boilerplate -- don't modify)                           |
| `seed/seed.json`         | Schema definition + demo content (collections, fields, taxonomies, menus, widgets) |
| `emdash-env.d.ts`        | Generated types for collections (auto-regenerated on dev server start)             |
| `src/layouts/Base.astro` | Base layout with EmDash wiring (menus, search, page contributions)                 |
| `src/pages/`             | Astro pages -- all server-rendered                                                 |

## Skills

Agent skills are in `.agents/skills/`. Load them when working on specific tasks:

- **building-emdash-site** -- Querying content, rendering Portable Text, schema design, seed files, site features (menus, widgets, search, SEO, comments, bylines). Start here.
- **creating-plugins** -- Building EmDash plugins with hooks, storage, admin UI, API routes, and Portable Text block types.
- **emdash-cli** -- CLI commands for content management, seeding, type generation, and visual editing flow.

## Documentation

The EmDash docs are available as an MCP server at `https://docs.emdashcms.com/mcp`. When you need to verify an API, hook, config option, field type, or pattern, call `search_docs` against the live documentation rather than relying on training-data recall. The docs reflect current behaviour; assumptions may not.

This template ships with `.mcp.json`, `.cursor/mcp.json`, and `.vscode/mcp.json` so Claude Code, Cursor, and VS Code auto-discover the docs server. Other tools (OpenCode, Windsurf, etc.) need a manual one-time setup -- see [docs.emdashcms.com/docs-mcp](https://docs.emdashcms.com/docs-mcp).

## Rules

- All content pages must be server-rendered (`output: "server"`). No `getStaticPaths()` for CMS content.
- Image fields are objects (`{ src, alt }`), not strings. Use `<Image image={...} />` from `"emdash/ui"`.
- `entry.id` is the slug (for URLs). `entry.data.id` is the database ULID (for API calls like `getEntryTerms`).
- When Astro's cache is enabled, pass content-query hints to `Astro.cache.set(cacheHint)`. Use the `WithCacheHint` variants for site settings, menus, taxonomies, and widget areas rendered by cached routes.
- Taxonomy names in queries must match the seed's `"name"` field exactly (e.g., `"category"` not `"categories"`).

## This Site

**Living & Glow** (livingandglow.com) -- a lifestyle affiliate-content site for US shoppers covering fashion, beauty, and home. Editorial guides live here; purchases happen at Amazon via disclosed affiliate links. Traffic plan: Pinterest -> guide -> Amazon.

## Pages

| Page        | Path               | What it shows                                                                                          |
| ----------- | ------------------ | ------------------------------------------------------------------------------------------------------ |
| Home        | `/`                | Brand promise hero, three category cards with start-here guides, recent guides, about band             |
| All posts   | `/posts`           | Full guide list with excerpts and tag chips                                                            |
| Post detail | `/posts/[slug]`    | Featured image, title, body, left meta column (authors + date), right TOC + search + categories gutter |
| Search      | `/search`          | Full-text search UI                                                                                    |
| Page        | `/pages/[slug]`    | Static pages: About, Contact, Affiliate Disclosure, Privacy Policy                                     |
| Category    | `/category/[slug]` | Posts filtered by category                                                                             |
| Tag         | `/tag/[slug]`      | Posts filtered by tag                                                                                  |
| RSS         | `/rss.xml`         | Generated feed                                                                                         |

## Schema

- `posts` collection: `title`, `featured_image`, `content` (Portable Text), `excerpt` (text).
- `pages` collection: `title`, `content` (Portable Text).
- Taxonomies: `category` (Fashion & Style, Beauty & Getting Ready, Home & Living, Gifts & Seasonal), `tag`.
- Menus: `primary` (Home, categories, About) and `footer` (Contact, Affiliate Disclosure, Privacy Policy).

Site settings have `title` and `tagline` -- both render in the header / footer.

## Custom blocks (lg-blocks plugin)

`plugins/lg-blocks` is a local native plugin adding affiliate-oriented Portable Text block types: `productCard`, `productList`, `affiliateDisclosure`, `callout`, `comparisonTable`. Admin declarations in `plugins/lg-blocks/src/index.ts`; Astro renderers in `plugins/lg-blocks/src/astro/` exported via `componentsEntry`.

Affiliate rules baked into the theme:

- Every affiliate CTA uses `rel="sponsored noopener"` and visible "(paid link)" labeling.
- `affiliateDisclosure` blocks must appear before the first product recommendation in a guide.
- Never render Amazon prices, star ratings, or copied reviews -- link out with "View on Amazon" style CTAs instead.

## Visual character

Warm lifestyle/editorial palette (`src/styles/theme.css`): cream background (`#faf6ef`), deep green ink (`#24382c`), terracotta accent (`#b0552f` = `--color-brand`). Body text is Inter; headings use **Fraunces** (loaded as `--font-fraunces` in `astro.config.mjs`, bound to `--font-heading`). JetBrains Mono for code/meta accents. Keep the single-accent rule -- no second accent colour.

The article layout is the standout feature: a three-column reading view with a left meta column (author bylines, date), centred 680px body column, and a right gutter for search, table of contents, and categories. Don't flatten that into one column on desktop -- the layout signals "this is something to read".

## Customisation

Design tokens live in `src/styles/tokens.css` with their default values. To restyle the site, override tokens in `src/styles/theme.css` -- declarations there are unlayered, so they always beat the `@layer base` defaults. Don't edit `tokens.css` or `Base.astro` for visual changes.

Colours are defined with `light-dark(<light>, <dark>)`, so each token carries both modes. Overriding with a plain colour changes light and dark at once; use `light-dark()` in the override to keep them distinct. There is no separate dark palette to maintain.

Webfonts are configured in `astro.config.mjs` under `fonts:`. To swap the body face, change the `name:` for the entry bound to `cssVariable: "--font-body"`. Good alternatives: Geist, IBM Plex Sans, Söhne (if you have a licence), Public Sans. If you want a serif-bodied blog, swap to a humanist serif like Source Serif, Crimson Pro, or Lora -- but then also raise `--font-size-base` to `1.0625rem` for readability. To give headings their own face (or use a system font) without touching the font pipeline, override `--font-heading` or `--font-body` in `theme.css`.

CSS variables worth knowing (see `tokens.css` for the full list):

- `--color-brand`, `--color-brand-hover`, `--color-on-brand`, `--color-brand-ring`
- `--color-bg`, `--color-bg-subtle`, `--color-surface`, `--color-text`, `--color-text-secondary`, `--color-muted`, `--color-border`, `--color-border-subtle`
- `--font-body`, `--font-heading`, `--font-mono`
- `--font-weight-heading` (600) / `--font-weight-display` (700) -- heading weights; lower them if you switch to a serif
- `--tracking-tight` / `--tracking-snug` / `--tracking-wide` / `--tracking-wider` -- letter-spacing tokens used across headings and meta labels
- `--content-width` (680px) -- article body column
- `--wide-width` (1200px) -- max container
- `--gutter-width` (200px) -- right sidebar (TOC) on article pages
- `--meta-col-width` (180px) -- left meta column on article pages
- `--avatar-size-{xs,sm,md,lg}` -- byline avatar sizes at different scales

## What not to do

- Don't add a second accent colour or coloured section backgrounds. One terracotta accent only.
- Don't replace Fraunces/Inter with a display sans (Bebas, Anton, etc.). Headings rely on warmth and weight contrast.
- Don't collapse the article gutter on desktop -- it's part of the reading experience.
- Don't use stock blog copy ("Welcome to my blog", "Stay tuned for more"). Write a real tagline that says what this blog is about.
- Don't seed the home page with three identical placeholder posts. If you only have one real post, show one real post.
- Comments are intentionally disabled -- no `commentsEnabled` in the seed and no comments UI on post pages. Re-add both together if that changes.
- Don't render Amazon prices, availability, ratings, or review text in templates or blocks.

## Docker / production

```bash
docker compose up -d --build   # app on :4321 + postgres, migrations + schema auto-seed on first boot
```

- `DATABASE_URL` selects Postgres; without it the app falls back to `sqlite` at `./data.db`.
- `S3_ENDPOINT` selects Bunny/S3 storage; without it media goes to `./uploads` (bind-mount it if used).
- Fill `.env` from `.env.example` (POSTGRES_*, EMDASH_*, S3_*). Never commit `.env`.
- On a fresh DB the runtime applies schema only; the setup wizard at `/_emdash/admin` offers the seed's starter content (3 guides, terms, bylines, media).
