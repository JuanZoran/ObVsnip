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
	const startOffset = Math.max(0, endOffset - prefixInfo.maxLength);
	const from = offsetToPos(editor, startOffset);
	const text = editor.getRange(from, cursor);

	return {
		text,
		startOffset,
		endOffset,
	};
};
