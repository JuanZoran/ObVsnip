import type { ParsedSnippet, SnippetContextCondition, SnippetFileConfig } from "../types";
import type { CursorContext } from "./editorContext";

const matchesCondition = (condition: SnippetContextCondition, ctx: CursorContext): boolean => {
	switch (condition.scope) {
		case "anywhere":
			return true;
		case "markdown":
			return !ctx.inCodeBlock && !ctx.inMathBlock && !ctx.inFrontmatter;
		case "codeblock":
			if (!ctx.inCodeBlock) return false;
			if (!condition.languages || condition.languages.length === 0) return true;
			return condition.languages.some(
				(lang) => ctx.codeLang?.toLowerCase() === lang.toLowerCase()
			);
		case "inline-code":
			return !ctx.inCodeBlock && ctx.inInlineCode;
		case "mathblock":
			return ctx.inMathBlock;
		case "inline-math":
			return ctx.inInlineMath && !ctx.inMathBlock;
		default:
			// 未知 scope 时不放行，避免规则被绕过
			return false;
	}
};

const isSnippetAllowed = (
	snippet: ParsedSnippet,
	ctx: CursorContext,
	configs?: Record<string, SnippetFileConfig>
): boolean => {
	if (!configs) return true;
	const source = snippet.source;
	const config = source ? configs[source] : undefined;
	if (!config) return true;
	if (config.enabled === false) return false;
	const conditions = Array.isArray(config.contexts) ? config.contexts : [];
	if (conditions.length === 0) return true;
	return conditions.some((condition) => matchesCondition(condition, ctx));
};

export const filterSnippetsByContext = (
	snippets: ParsedSnippet[],
	ctx: CursorContext,
	configs?: Record<string, SnippetFileConfig>
): ParsedSnippet[] => {
	return snippets.filter((snippet) => isSnippetAllowed(snippet, ctx, configs));
};
