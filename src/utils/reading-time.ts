import type { PortableTextBlock } from "emdash";

const WORDS_PER_MINUTE = 200;
const CJK_CHARACTERS_PER_MINUTE = 500;
const WHITESPACE_REGEX = /\s+/;
const CJK_CHARACTER_REGEX =
	/\p{Script=Han}|\p{Script=Hangul}|\p{Script=Hiragana}|\p{Script=Katakana}/gu;

type PortableTextSpan = {
	_type: string;
	text?: string;
};

type PortableTextTextBlock = PortableTextBlock & {
	_type: "block";
	children: PortableTextSpan[];
};

function isTextBlock(block: PortableTextBlock): block is PortableTextTextBlock {
	return block._type === "block" && Array.isArray(block.children);
}

function countWords(text: string): number {
	return text.split(WHITESPACE_REGEX).filter(Boolean).length;
}

function countCjkCharacters(text: string): number {
	return text.match(CJK_CHARACTER_REGEX)?.length ?? 0;
}

function textOfBlock(block: PortableTextTextBlock): string {
	return block.children
		.filter((child) => child._type === "span" && typeof child.text === "string")
		.map((span) => span.text)
		.join("");
}

function isPortableTextArray(value: unknown): value is PortableTextBlock[] {
	return (
		Array.isArray(value) &&
		value.some(
			(item) =>
				item &&
				typeof item === "object" &&
				(item as { _type?: string })._type === "block",
		)
	);
}

/**
 * Recursively collect Portable Text embedded in a value. Handles both raw
 * Portable Text arrays and `blocks` fields where rich text lives inside
 * block sub-fields (e.g. widget_prose.body, widget_notice.body).
 */
function collectPortableText(value: unknown, depth = 0): PortableTextBlock[] {
	if (depth > 8 || value == null) return [];
	if (isPortableTextArray(value)) return value;
	if (Array.isArray(value)) {
		return value.flatMap((item) => collectPortableText(item, depth + 1));
	}
	if (typeof value === "object") {
		return Object.values(value).flatMap((item) =>
			collectPortableText(item, depth + 1),
		);
	}
	return [];
}

/**
 * Extract plain text from Portable Text content or a blocks field value
 */
export function extractText(content: unknown): string {
	return collectPortableText(content)
		.filter(isTextBlock)
		.map(textOfBlock)
		.join(" ");
}

/**
 * Calculate reading time in minutes from Portable Text content
 */
export function getReadingTime(content: unknown): number {
	const text = extractText(content);
	const cjkCharacterCount = countCjkCharacters(text);
	const wordCount = countWords(text.replace(CJK_CHARACTER_REGEX, " "));
	const minutes = Math.ceil(
		wordCount / WORDS_PER_MINUTE + cjkCharacterCount / CJK_CHARACTERS_PER_MINUTE,
	);
	return Math.max(1, minutes);
}

/**
 * Format reading time for display
 */
export function formatReadingTime(minutes: number): string {
	return `${minutes} min read`;
}
