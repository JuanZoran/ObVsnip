import { editorEditorField, MarkdownView } from "obsidian";
import type { App, Editor } from "obsidian";
import type { EditorView } from "@codemirror/view";
import { posToOffset } from "./positionUtils";

export function getEditorView(editor: Editor): EditorView | null {
	const anyEditor = editor as unknown as {
		cm?: {
			state?: { field?: <T>(field: unknown) => T };
			view?: EditorView;
			cm?: EditorView;
		};
	};

	const cm = anyEditor?.cm;
	if (!cm) return null;

	const state = cm.state as { field?: <T>(field: unknown) => T } | undefined;
	if (state?.field) {
		try {
			const view = state.field(editorEditorField) as EditorView;
			if (view) {
				return view;
			}
		} catch {
			// ignore lookup failures
		}
	}

	const candidates = [cm.view, cm.cm, cm as EditorView];
	for (const candidate of candidates) {
		if (candidate && typeof (candidate as EditorView).dispatch === 'function') {
			return candidate as EditorView;
		}
	}

	return null;
}

export const getActiveMarkdownView = (app: App): MarkdownView | null => {
	return app.workspace.getActiveViewOfType(MarkdownView) ?? null;
};

export const getActiveEditor = (app: App): Editor | null => {
	return getActiveMarkdownView(app)?.editor ?? null;
};

/**
 * Find the Editor instance that corresponds to a given EditorView
 * @param app The Obsidian app instance
 * @param view The CodeMirror EditorView to find the editor for
 * @returns The Editor instance, or null if not found
 */
export const findEditorByView = (app: App, view: EditorView): Editor | null => {
	// Try to find the editor by matching views across all MarkdownViews
	const markdownViews = app.workspace.getLeavesOfType("markdown");
	for (const leaf of markdownViews) {
		const markdownView = leaf.view;
		if (markdownView instanceof MarkdownView) {
			const editorView = getEditorView(markdownView.editor);
			if (editorView === view) {
				return markdownView.editor;
			}
		}
	}
	// Fallback to active editor if not found (shouldn't happen in normal usage)
	return getActiveEditor(app);
};

/**
 * Get cursor coordinates for positioning UI elements
 * @param editor The editor instance
 * @returns Object with top and left coordinates, or fallback coordinates if EditorView is unavailable
 */
export function getCursorCoords(editor: Editor): { top: number; left: number } {
	const cursor = editor.getCursor();
	const editorView = getEditorView(editor);

	if (editorView) {
		const offset = posToOffset(editor, cursor);
		const coords = editorView.coordsAtPos(offset);

		if (coords) {
			return { top: coords.bottom + 4, left: coords.left };
		}
	}

	// Fallback calculation when EditorView is not available
	const line = editor.getLine(cursor.line) ?? "";
	const charWidth = 8;
	const top = cursor.line * 20 + 40;
	const left = line.length * charWidth + 40;

	return { top, left };
}
