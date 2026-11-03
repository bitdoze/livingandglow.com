import { definePlugin } from "emdash";
import type { PluginDescriptor, RouteContext } from "emdash";
import { z } from "zod";

export function lgBlocksPlugin(): PluginDescriptor {
	return {
		id: "lg-blocks",
		version: "1.2.0",
		entrypoint: "lg-blocks",
		componentsEntry: "lg-blocks/astro",
	};
}

const catalogInputSchema = z
	.object({
		collection: z.string().optional(),
	})
	.strict();

type CatalogInput = z.infer<typeof catalogInputSchema>;

const catalogOutput = {
	placement: {
		topLevel:
			"Blocks listed in each collection's allowedTypes are appended to that collection's `content` blocks field — pass them as objects with `_type` inside `data.content` on content_create / content_update. They are stored inline in the post body, never as separate records.",
		nested:
			"The inlineBlocks below are Portable Text types that live inside a widget_prose block's `body` array. Entries with alsoTopLevel=true are the widget_* blocks — valid BOTH nested in body and at top level in `content`. The rest (alsoTopLevel=false) are body-only and rejected at the top level.",
		fieldDetails:
			"Call schema_get_block_type with a slug for the full field schema of any top-level block type.",
	},
	inlineBlocksNote:
		"Inline blocks appear as {_type: \"<type>\", ...fields} entries inside widget_prose.body, alongside regular {style: \"normal\", _type: \"block\"} paragraphs.",
};

const inlineFieldNames = (block: { fields?: Array<Record<string, unknown>> }): string[] =>
	(block.fields ?? []).map((field) => String(field.action_id ?? field.type ?? "")).filter(Boolean);

async function handleCatalog(ctx: RouteContext<CatalogInput>) {
	const slugs = ctx.input?.collection ? [ctx.input.collection] : ["posts", "pages"];
	const collections: Record<string, unknown> = {};
	for (const slug of slugs) {
		const info = await ctx.schema?.getCollection(slug);
		const field = info?.fields.find((candidate) => candidate.type === "blocks");
		if (!field) continue;
		collections[slug] = {
			blocksField: field.slug,
			allowedTypes: field.validation?.allowedTypes ?? [],
		};
	}
	return {
		...catalogOutput,
		collections,
		inlineBlocks: [
			...INLINE_BLOCKS.map((block) => ({ ...block, alsoTopLevel: false })),
			...WIDGET_INLINE_BLOCKS.map((block) => ({ ...block, alsoTopLevel: true })),
		].map((block) => ({
			type: block.type,
			label: block.label,
			description: block.description ?? null,
			category: block.category ?? null,
			alsoTopLevel: block.alsoTopLevel,
			fields: inlineFieldNames(block),
		})),
	};
}

const INLINE_BLOCKS = [
				{
					type: "affiliateDisclosure",
					label: "Affiliate Disclosure",
					icon: "link",
					category: "Shopping",
					description:
						"Standard affiliate disclosure notice. Place before the first product recommendation.",
					fields: [
						{
							type: "text_input",
							action_id: "text",
							label: "Custom wording (optional)",
							multiline: true,
							placeholder:
								"Leave empty for the default Amazon Associates disclosure.",
						},
					],
				},
				{
					type: "productCard",
					label: "Product Card",
					icon: "link-external",
					category: "Shopping",
					description:
						"A single product pick with image, why it made the list, and an Amazon button.",
					fields: [
						{ type: "text_input", action_id: "title", label: "Product name" },
						{
							type: "media_picker",
							action_id: "image",
							label: "Product image",
							mime_type_filter: "image/",
						},
						{
							type: "text_input",
							action_id: "note",
							label: "Why it made the list",
							multiline: true,
						},
						{
							type: "text_input",
							action_id: "caveat",
							label: "Keep in mind (limitation)",
							multiline: true,
						},
						{
							type: "text_input",
							action_id: "url",
							label: "Amazon link (affiliate URL)",
							placeholder: "https://www.amazon.com/...?tag=...",
						},
						{
							type: "text_input",
							action_id: "buttonLabel",
							label: "Button label",
							placeholder: "View on Amazon",
						},
					],
				},
				{
					type: "productList",
					label: "Shop This Guide",
					icon: "link-external",
					category: "Shopping",
					description:
						"A compact linked list of the products mentioned in the guide.",
					fields: [
						{
							type: "text_input",
							action_id: "heading",
							label: "Heading",
							placeholder: "Shop this guide",
						},
						{
							type: "repeater",
							action_id: "items",
							label: "Products",
							item_label: "Product",
							fields: [
								{ type: "text_input", action_id: "name", label: "Name" },
								{
									type: "text_input",
									action_id: "detail",
									label: "Short note",
								},
								{
									type: "text_input",
									action_id: "url",
									label: "Affiliate URL",
								},
							],
						},
					],
				},
				{
					type: "comparisonTable",
					label: "Decision Table",
					icon: "code",
					category: "Shopping",
					description:
						"Compare picks side by side: best for, keep in mind, and a link.",
					fields: [
						{
							type: "text_input",
							action_id: "heading",
							label: "Heading",
							placeholder: "Which one should you choose?",
						},
						{
							type: "repeater",
							action_id: "rows",
							label: "Products",
							item_label: "Product",
							fields: [
								{ type: "text_input", action_id: "item", label: "Product" },
								{
									type: "text_input",
									action_id: "bestFor",
									label: "Best for",
								},
								{
									type: "text_input",
									action_id: "keepInMind",
									label: "Keep in mind",
								},
								{
									type: "text_input",
									action_id: "url",
									label: "Affiliate URL",
								},
							],
						},
					],
				},
				{
					type: "callout",
					label: "Callout",
					icon: "link",
					category: "Editorial",
					description:
						"A highlighted tip or note inside the article body.",
					fields: [
						{
							type: "select",
							action_id: "variant",
							label: "Style",
							options: [
								{ label: "Tip", value: "tip" },
								{ label: "Note", value: "note" },
								{ label: "Good to know", value: "remember" },
							],
						},
						{
							type: "text_input",
							action_id: "text",
							label: "Text",
							multiline: true,
						},
					],
				},
];

/**
 * The 19 widget_* types also registered as Portable Text blocks so they are
 * insertable via the `/` slash menu inside widget_prose.body. Field names
 * mirror the database block types; the PT-modal equivalents stand in for
 * field types the modal cannot produce (`portableText` -> multiline text,
 * `image` -> media_picker). widget_prose itself is excluded — it is the
 * container these blocks embed into.
 */
const ICON_CHOICES = ["arrow-right", "arrow-up-right", "download", "play", "check", "star", "info", "rocket", "book", "github", "mail", "terminal"].map(
	(option) => ({ label: option, value: option }),
);

const WIDGET_INLINE_BLOCKS = [
	{
		type: "widget_notice",
		label: "Notice",
		icon: "form",
		category: "Widgets",
		description: "Colored callout for tips, warnings, prerequisites and pitfalls.",
		fields: [
			{
				type: "select",
				action_id: "kind",
				label: "Kind",
				options: [
					{ label: "Info", value: "info" },
					{ label: "Success", value: "success" },
					{ label: "Warning", value: "warning" },
					{ label: "Danger", value: "danger" },
				],
			},
			{ type: "text_input", action_id: "title", label: "Title" },
			{ type: "text_input", action_id: "body", label: "Body", multiline: true },
		],
	},
	{
		type: "widget_accordion",
		label: "Accordion",
		icon: "form",
		category: "Widgets",
		description: "Collapsible sections — FAQs, optional steps, details that should not dominate the page.",
		fields: [
			{ type: "text_input", action_id: "heading", label: "Heading" },
			{
				type: "repeater",
				action_id: "items",
				label: "Items",
				item_label: "Item",
				fields: [
					{ type: "text_input", action_id: "title", label: "Title" },
					{ type: "text_input", action_id: "body", label: "Body", multiline: true },
				],
			},
		],
	},
	{
		type: "widget_tabs",
		label: "Tabs",
		icon: "form",
		category: "Widgets",
		description: "Tabbed panels — one tab per OS, per package manager, per plan.",
		fields: [
			{
				type: "repeater",
				action_id: "items",
				label: "Tabs",
				item_label: "Tab",
				fields: [
					{ type: "text_input", action_id: "label", label: "Label" },
					{ type: "text_input", action_id: "body", label: "Body", multiline: true },
				],
			},
		],
	},
	{
		type: "widget_checklist",
		label: "Checklist",
		icon: "form",
		category: "Widgets",
		description: "Checkmarked list — requirements, takeaways, do-this-first items.",
		fields: [
			{ type: "text_input", action_id: "title", label: "Title" },
			{
				type: "repeater",
				action_id: "items",
				label: "Items",
				item_label: "Item",
				fields: [{ type: "text_input", action_id: "text", label: "Text" }],
			},
		],
	},
	{
		type: "widget_steps",
		label: "Steps",
		icon: "form",
		category: "Widgets",
		description: "Numbered how-to steps — walkthroughs, setup guides, ordered processes.",
		fields: [
			{ type: "text_input", action_id: "title", label: "Title" },
			{
				type: "repeater",
				action_id: "items",
				label: "Steps",
				item_label: "Step",
				fields: [
					{ type: "text_input", action_id: "title", label: "Step title" },
					{ type: "text_input", action_id: "body", label: "Details", multiline: true },
				],
			},
		],
	},
	{
		type: "widget_button",
		label: "Button",
		icon: "link-external",
		category: "Widgets",
		description: "Standalone call-to-action or download link.",
		fields: [
			{ type: "text_input", action_id: "label", label: "Label" },
			{ type: "text_input", action_id: "url", label: "URL", placeholder: "https://… or /path" },
			{ type: "select", action_id: "icon", label: "Icon", options: ICON_CHOICES },
			{
				type: "select",
				action_id: "variant",
				label: "Variant",
				options: [
					{ label: "Solid", value: "solid" },
					{ label: "Outline", value: "outline" },
				],
			},
			{
				type: "select",
				action_id: "align",
				label: "Align",
				options: [
					{ label: "Left", value: "left" },
					{ label: "Center", value: "center" },
					{ label: "Right", value: "right" },
				],
			},
			{ type: "toggle", action_id: "new_tab", label: "Open in new tab" },
		],
	},
	{
		type: "widget_youtube",
		label: "YouTube video",
		icon: "video",
		category: "Widgets",
		description: "Click-to-play YouTube embed. Loads no player (and sets no cookies) until the visitor asks.",
		fields: [
			{ type: "text_input", action_id: "url", label: "YouTube URL" },
			{ type: "text_input", action_id: "title", label: "Title" },
			{ type: "text_input", action_id: "caption", label: "Caption", multiline: true },
		],
	},
	{
		type: "widget_embed",
		label: "Embed",
		icon: "code",
		category: "Widgets",
		description: "Generic iframe embed with a fixed aspect ratio — CodePen, maps, third-party players.",
		fields: [
			{ type: "text_input", action_id: "url", label: "Embed URL" },
			{ type: "text_input", action_id: "title", label: "Title" },
			{
				type: "select",
				action_id: "aspect",
				label: "Aspect ratio",
				options: [
					{ label: "16:9", value: "16:9" },
					{ label: "4:3", value: "4:3" },
					{ label: "1:1", value: "1:1" },
					{ label: "9:16", value: "9:16" },
				],
			},
		],
	},
	{
		type: "widget_image",
		label: "Image",
		icon: "form",
		category: "Widgets",
		description: "A figure with an optional caption — screenshots, diagrams, photos inside an article.",
		fields: [
			{ type: "media_picker", action_id: "image", label: "Image", mime_type_filter: "image/" },
			{ type: "text_input", action_id: "caption", label: "Caption", multiline: true },
			{ type: "toggle", action_id: "wide", label: "Wide layout" },
		],
	},
	{
		type: "widget_code",
		label: "Code block",
		icon: "code",
		category: "Widgets",
		description: "A code sample with language label, optional filename and copy button.",
		fields: [
			{
				type: "select",
				action_id: "language",
				label: "Language",
				options: ["plaintext", "bash", "typescript", "javascript", "json", "html", "css", "yaml", "sql", "python"].map(
					(option) => ({ label: option, value: option }),
				),
			},
			{ type: "text_input", action_id: "filename", label: "Filename" },
			{ type: "text_input", action_id: "code", label: "Code", multiline: true },
		],
	},
	{
		type: "widget_product",
		label: "Product box",
		icon: "link-external",
		category: "Widgets",
		description: "Review or affiliate card: rating, description, pros and cons, price and a buy button.",
		fields: [
			{ type: "text_input", action_id: "name", label: "Product name" },
			{ type: "media_picker", action_id: "image", label: "Product image", mime_type_filter: "image/" },
			{ type: "number_input", action_id: "rating", label: "Rating (0–5)" },
			{ type: "text_input", action_id: "description", label: "Description", multiline: true },
			{
				type: "repeater",
				action_id: "pros",
				label: "Pros",
				item_label: "Pro",
				fields: [{ type: "text_input", action_id: "text", label: "Text" }],
			},
			{
				type: "repeater",
				action_id: "cons",
				label: "Cons",
				item_label: "Con",
				fields: [{ type: "text_input", action_id: "text", label: "Text" }],
			},
			{ type: "text_input", action_id: "price", label: "Price label" },
			{ type: "text_input", action_id: "url", label: "Buy URL" },
			{ type: "text_input", action_id: "cta_label", label: "Button label", placeholder: "Check price" },
		],
	},
	{
		type: "widget_cards",
		label: "Link cards",
		icon: "link",
		category: "Widgets",
		description: "A grid of linked cards — related tools, further reading, resources.",
		fields: [
			{ type: "text_input", action_id: "title", label: "Title" },
			{
				type: "repeater",
				action_id: "items",
				label: "Cards",
				item_label: "Card",
				fields: [
					{ type: "select", action_id: "icon", label: "Icon", options: ICON_CHOICES },
					{ type: "text_input", action_id: "title", label: "Title" },
					{ type: "text_input", action_id: "url", label: "URL" },
					{ type: "text_input", action_id: "description", label: "Description" },
				],
			},
		],
	},
	{
		type: "widget_quote",
		label: "Pull quote",
		icon: "form",
		category: "Widgets",
		description: "Highlighted quotation with attribution.",
		fields: [
			{ type: "text_input", action_id: "quote", label: "Quote", multiline: true },
			{ type: "text_input", action_id: "attribution", label: "Attribution" },
			{ type: "text_input", action_id: "role", label: "Role" },
		],
	},
	{
		type: "widget_facts",
		label: "Facts table",
		icon: "form",
		category: "Widgets",
		description: "Key/value spec sheet — pricing tiers, versions, limits, requirements.",
		fields: [
			{ type: "text_input", action_id: "title", label: "Title" },
			{
				type: "repeater",
				action_id: "items",
				label: "Rows",
				item_label: "Row",
				fields: [
					{ type: "text_input", action_id: "label", label: "Label" },
					{ type: "text_input", action_id: "value", label: "Value" },
				],
			},
		],
	},
	{
		type: "widget_toc",
		label: "Table of contents",
		icon: "form",
		category: "Widgets",
		description: "Lists the article's headings and links to them. Filled automatically in the browser.",
		fields: [{ type: "text_input", action_id: "title", label: "Title" }],
	},
	{
		type: "widget_series",
		label: "Series nav",
		icon: "form",
		category: "Widgets",
		description: "Ordered navigation for multi-part posts. The current part is highlighted automatically from the URL.",
		fields: [
			{ type: "text_input", action_id: "title", label: "Title" },
			{
				type: "repeater",
				action_id: "items",
				label: "Parts",
				item_label: "Part",
				fields: [
					{ type: "text_input", action_id: "label", label: "Label" },
					{ type: "text_input", action_id: "url", label: "URL" },
				],
			},
		],
	},
	{
		type: "widget_latest_posts",
		label: "Latest posts",
		icon: "form",
		category: "Widgets",
		description: "Live list of the newest published entries in a collection, resolved by the Widgets plugin.",
		fields: [
			{ type: "text_input", action_id: "heading", label: "Heading" },
			{ type: "text_input", action_id: "collection", label: "Collection", placeholder: "posts" },
			{ type: "number_input", action_id: "limit", label: "Limit" },
			{ type: "toggle", action_id: "exclude_current", label: "Exclude current post" },
		],
	},
	{
		type: "widget_divider",
		label: "Divider",
		icon: "form",
		category: "Widgets",
		description: "A section break inside the article — a line, dots, or whitespace.",
		fields: [
			{
				type: "select",
				action_id: "style",
				label: "Style",
				options: [
					{ label: "Line", value: "line" },
					{ label: "Dots", value: "dots" },
					{ label: "Space", value: "space" },
				],
			},
		],
	},
];

export function createPlugin() {
	return definePlugin({
		id: "lg-blocks",
		version: "1.2.0",
		capabilities: ["schema:read"],
		routes: {
			catalog: {
				permission: "content:read",
				request: { body: "json" },
				input: catalogInputSchema,
				handler: handleCatalog,
			},
		},
		mcp: {
			tools: {
				block_catalog: {
					description:
						"List every content block type usable in post/page bodies: the top-level widget_* blocks allowed in each collection's `content` field, plus the inline Portable Text types that must be nested inside a widget_prose block's `body`. Blocks are inserted via content_create / content_update — always inline in `data.content`, never as separate block records.",
					route: "catalog",
					input: catalogInputSchema,
				},
			},
		},
		admin: {
			portableTextBlocks: [...INLINE_BLOCKS, ...WIDGET_INLINE_BLOCKS],
		},
	});
}
