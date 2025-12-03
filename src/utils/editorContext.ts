import type { Editor } from "obsidian";

export interface CursorContext {
	inCodeBlock: boolean;
	codeLang?: string;
	inInlineCode: boolean;
	inMathBlock: boolean;
	inInlineMath: boolean;
	inFrontmatter: boolean;
}

const isEscaped = (text: string, index: number): boolean => {
	let backslashes = 0;
	for (let i = index - 1; i >= 0; i--) {
		if (text[i] === "\\") {
			backslashes++;
		} else {
			break;
		}
	}
	return backslashes % 2 === 1;
};

const countToken = (text: string, token: string, limit?: number): number => {
	const end = typeof limit === "number" ? Math.max(0, Math.min(limit, text.length)) : text.length;
	let count = 0;
	let index = 0;
	while (index < end) {
		const found = text.indexOf(token, index);
		if (found < 0 || found >= end) break;
		if (!isEscaped(text, found)) {
			count++;
		}
		index = found + token.length;
	}
	return count;
};

export const getCursorContext = (editor: Editor): CursorContext => {
	const cursor = editor.getCursor();
	const lineCount =
		typeof (editor as any).lineCount === "function"
			? (editor as any).lineCount()
			: typeof (editor as any).getValue === "function"
				? ((editor as any).getValue() as string).split("\n").length
				: typeof (editor as any).getText === "function"
					? ((editor as any).getText() as string).split("\n").length
					: 1;
	const targetLine = Math.min(Math.max(cursor.line, 0), lineCount - 1);

	let inFrontmatter = false;
	let frontmatterClosed = false;
	let inCodeBlock = false;
	let codeFence: { marker: "`" | "~"; length: number } | null = null;
	let codeLang: string | undefined;
	let inMathBlock = false;

	for (let lineNum = 0; lineNum <= targetLine; lineNum++) {
		const lineTextFull = editor.getLine(lineNum) ?? "";
		const isCursorLine = lineNum === targetLine;
		const lineText = isCursorLine ? lineTextFull.slice(0, cursor.ch) : lineTextFull;

		// Frontmatter detection (only at top of file)
		if (lineNum === 0 && lineTextFull.trim() === "---") {
			inFrontmatter = true;
		} else if (inFrontmatter && !frontmatterClosed && lineTextFull.trim() === "---") {
			frontmatterClosed = true;
			inFrontmatter = false;
		}
		if (inFrontmatter) {
			// Skip other detections while inside frontmatter
			continue;
		}

		// Fenced code blocks
		const fenceMatch = lineTextFull.match(/^(\s*)(`{3,}|~{3,})(.*)$/);
		if (fenceMatch && !inCodeBlock) {
			const markerChar = fenceMatch[2][0] as "`" | "~";
			codeFence = { marker: markerChar, length: fenceMatch[2].length };
			inCodeBlock = true;
			const langRaw = (fenceMatch[3] ?? "").trim();
			codeLang = langRaw.length > 0 ? langRaw.split(/\s+/)[0] : undefined;
			continue;
		}
		if (
			inCodeBlock &&
			codeFence &&
			lineTextFull.startsWith(codeFence.marker.repeat(codeFence.length))
		) {
			inCodeBlock = false;
			codeFence = null;
			codeLang = undefined;
			continue;
		}

		// Math block toggles (only when not in code block)
		if (!inCodeBlock) {
			const mathToggles = countToken(lineText, "$$");
			if (mathToggles % 2 === 1) {
				inMathBlock = !inMathBlock;
			}
		}
	}

	// Inline code detection (cursor line only, not inside fenced code)
	const cursorLineText = editor.getLine(targetLine) ?? "";
	const textToCursor = cursorLineText.slice(0, cursor.ch);
	let inInlineCode = false;
	if (!inCodeBlock) {
		const backtickCount = countToken(textToCursor, "`");
		inInlineCode = backtickCount % 2 === 1;
	}

	// Inline math detection (cursor line, when not in fenced code)
	let inInlineMath = false;
	if (!inCodeBlock && !inMathBlock) {
		let pendingDollar = false;
		for (let i = 0; i < textToCursor.length; i++) {
			const char = textToCursor[i];
			if (char === "$" && !isEscaped(textToCursor, i)) {
				// Skip if part of $$ (handled above)
				const isDouble =
					i + 1 < textToCursor.length && textToCursor[i + 1] === "$" && !isEscaped(textToCursor, i + 1);
				if (isDouble) {
					// advance one extra to skip the second $
					i += 1;
					continue;
				}
				pendingDollar = !pendingDollar;
			}
		}
		inInlineMath = pendingDollar;
	}

	return {
		inCodeBlock,
		codeLang,
		inInlineCode,
		inMathBlock,
		inInlineMath,
		inFrontmatter,
	};
};
