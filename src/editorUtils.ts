import type { Editor } from 'obsidian';
import type { EditorView } from '@codemirror/view';
import { editorEditorField } from 'obsidian';

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
