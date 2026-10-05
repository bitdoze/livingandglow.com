import { definePlugin } from "emdash";
import type { PluginDescriptor } from "emdash";

export function lgBlocksPlugin(): PluginDescriptor {
	return {
		id: "lg-blocks",
		version: "1.0.0",
		entrypoint: "lg-blocks",
		componentsEntry: "lg-blocks/astro",
	};
}

export function createPlugin() {
	return definePlugin({
		id: "lg-blocks",
		version: "1.0.0",
		admin: {
			portableTextBlocks: [
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
			],
		},
	});
}
