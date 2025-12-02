import type { Editor } from "obsidian";
import type { PrefixInfo } from "../types";
import { posToOffset, offsetToPos } from "./positionUtils";

export interface PrefixContextOptions {
	editor: Editor;
	prefixInfo: PrefixInfo;
}

export interface PrefixContextResult {
	text: string;
	startOffset: number;
	endOffset: number;
}

export const getContextBeforeCursor = (
	options: PrefixContextOptions
): PrefixContextResult | null => {
	const { editor, prefixInfo } = options;
	if (!prefixInfo?.maxLength) {
		return null;
	}

	const cursor = editor.getCursor();
	const endOffset = posToOffset(editor, cursor);
	// Restrict window to current line to avoid cross-line matching
	const lineStartOffset = posToOffset(editor, { line: cursor.line, ch: 0 });
	const startOffset = Math.max(
		lineStartOffset,
		endOffset - prefixInfo.maxLength
	);
	const from = offsetToPos(editor, startOffset);
	const text = editor.getRange(from, cursor);

	return {
		text,
		startOffset,
		endOffset,
	};
};
