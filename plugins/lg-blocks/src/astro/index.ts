import AffiliateDisclosure from "./AffiliateDisclosure.astro";
import Callout from "./Callout.astro";
import ComparisonTable from "./ComparisonTable.astro";
import InlineWidget from "./InlineWidget.astro";
import ProductCard from "./ProductCard.astro";
import ProductList from "./ProductList.astro";

export const blockComponents = {
	affiliateDisclosure: AffiliateDisclosure,
	productCard: ProductCard,
	productList: ProductList,
	comparisonTable: ComparisonTable,
	callout: Callout,
	widget_accordion: InlineWidget,
	widget_button: InlineWidget,
	widget_cards: InlineWidget,
	widget_checklist: InlineWidget,
	widget_code: InlineWidget,
	widget_divider: InlineWidget,
	widget_embed: InlineWidget,
	widget_facts: InlineWidget,
	widget_image: InlineWidget,
	widget_latest_posts: InlineWidget,
	widget_notice: InlineWidget,
	widget_product: InlineWidget,
	widget_quote: InlineWidget,
	widget_series: InlineWidget,
	widget_steps: InlineWidget,
	widget_tabs: InlineWidget,
	widget_toc: InlineWidget,
	widget_youtube: InlineWidget,
};
