import { editorEditorField, MarkdownView } from "obsidian";
import type { App, Editor } from "obsidian";
import type { EditorView } from "@codemirror/view";

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
