import { definePlugin } from "emdash";
import type { PluginDescriptor, RouteContext } from "emdash";
import { z } from "zod";

export function lgBlocksPlugin(): PluginDescriptor {
	return {
		id: "lg-blocks",
		version: "1.1.0",
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
			"The inlineBlocks below are Portable Text types that only live inside a widget_prose block's `body` array — they are rejected at the top level.",
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
		inlineBlocks: INLINE_BLOCKS.map((block) => ({
			type: block.type,
			label: block.label,
			description: block.description ?? null,
			category: block.category ?? null,
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

export function createPlugin() {
	return definePlugin({
		id: "lg-blocks",
		version: "1.1.0",
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
			portableTextBlocks: INLINE_BLOCKS,
		},
	});
}
