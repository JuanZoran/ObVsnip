import { EditorState, Transaction, type TransactionSpec } from '@codemirror/state';
import {
	snippetSessionField,
	getRealtimeSyncCallback,
	pushSnippetSessionEffect,
	popSnippetSessionEffect,
	replaceSnippetSessionEffect,
	clearSnippetSessionsEffect,
} from '../../src/snippetSession';

export class MockEditor {
	private text: string[];
	private cursor = { line: 0, ch: 0 };
	private selection: { anchor: { line: number; ch: number }; head: { line: number; ch: number } };
	private boundView?: MockEditorView;

	constructor(initialText = '') {
		this.text = initialText.split('\n');
		this.selection = { anchor: { ...this.cursor }, head: { ...this.cursor } };
	}

	getCursor(which?: 'from' | 'to'): { line: number; ch: number } {
		if (which === 'from') return { ...this.selection.anchor };
		if (which === 'to') return { ...this.selection.head };
		return { ...this.cursor };
	}

	getLine(line: number): string {
		return this.text[line] ?? '';
	}

	lineCount(): number {
		return this.text.length;
	}

	getValue(): string {
		return this.getText();
	}

	getSelection(): string {
		const from = this.posToOffset(this.selection.anchor);
		const to = this.posToOffset(this.selection.head);
		const [start, end] = from <= to ? [from, to] : [to, from];
		return this.getText().slice(start, end);
	}

	setCursor(pos: { line: number; ch: number }): void {
		this.cursor = { ...pos };
		this.selection = { anchor: { ...pos }, head: { ...pos } };
	}

	setSelection(anchor: { line: number; ch: number }, head: { line: number; ch: number }): void {
		this.selection = { anchor: { ...anchor }, head: { ...head } };
		this.cursor = { ...head };
	}

	replaceRange(text: string, from: { line: number; ch: number }, to: { line: number; ch: number }): void {
		const start = this.posToOffset(from);
		const end = this.posToOffset(to);

		// If linked to a view, dispatch the change through the view to keep state in sync
		if (this.boundView) {
			const cursorOffset = start + text.length;
			this.boundView.dispatch({
				changes: { from: start, to: end, insert: text },
				selection: { anchor: cursorOffset, head: cursorOffset },
			});
			return;
		}

		const current = this.getText();
		const next = current.slice(0, start) + text + current.slice(end);
		this.text = next.split('\n');
		const cursorOffset = start + text.length;
		this.setCursor(this.offsetToPos(cursorOffset));
	}

	getRange(from: { line: number; ch: number }, to: { line: number; ch: number }): string {
		const start = this.posToOffset(from);
		const end = this.posToOffset(to);
		const current = this.getText();
		return current.slice(start, end);
	}

	posToOffset(pos: { line: number; ch: number }): number {
		let offset = 0;
		for (let i = 0; i < pos.line; i++) {
			offset += (this.text[i] ?? '').length + 1;
		}
		return offset + pos.ch;
	}

	offsetToPos(offset: number): { line: number; ch: number } {
		let remaining = offset;
		for (let i = 0; i < this.text.length; i++) {
			const line = this.text[i] ?? '';
			if (remaining <= line.length) {
				return { line: i, ch: remaining };
			}
			remaining -= line.length + 1;
		}
		return { line: this.text.length - 1, ch: (this.text[this.text.length - 1] ?? '').length };
	}

	getText(): string {
		return this.text.join('\n');
	}

	setTextFromView(docText: string, selectionFrom: number, selectionTo: number): void {
		this.text = docText.split('\n');
		const anchor = this.offsetToPos(selectionFrom);
		const head = this.offsetToPos(selectionTo);
		this.setSelection(anchor, head);
	}

	bindView(view: MockEditorView): void {
		this.boundView = view;
	}
}

export class MockEditorView {
	state: EditorState;
	private boundEditor?: MockEditor;

	constructor(initialText = '', boundEditor?: MockEditor) {
		this.boundEditor = boundEditor;
		if (boundEditor) {
			boundEditor.bindView(this);
		}
		this.state = EditorState.create({
			doc: initialText,
			extensions: [snippetSessionField],
		});
	}

	bindEditor(editor: MockEditor): void {
		this.boundEditor = editor;
		editor.bindView(this);
	}

	dispatch(spec: TransactionSpec): void {
		const tr = this.state.update(spec);
		this.state = tr.state;

		// In Obsidian, view.dispatch updates the editor document automatically.
		// Mirror that behavior in tests when a bound editor exists.
		if (this.boundEditor && tr.docChanged) {
			const docText = this.state.doc.toString();
			const selection = this.state.selection.main;
			this.boundEditor.setTextFromView(docText, selection.from, selection.to);
		}

		// Simulate realtime sync trigger from the view plugin
		if (tr.docChanged) {
			const callback = getRealtimeSyncCallback();
			const isSnippetSync = tr.annotation(Transaction.userEvent) === 'snippet-sync';
			const sessionChangedByEffect = tr.effects.some(effect =>
				effect.is(pushSnippetSessionEffect) ||
				effect.is(popSnippetSessionEffect) ||
				effect.is(replaceSnippetSessionEffect) ||
				effect.is(clearSnippetSessionsEffect)
			);

			if (callback && !sessionChangedByEffect && !isSnippetSync) {
				const stack = this.state.field(snippetSessionField);
				if (stack && stack.length > 0) {
					const session = stack[stack.length - 1];
					const currentStop = session.stops.find(
						stop => stop.index === session.currentIndex
					);

					if (currentStop) {
						callback(this as any, session, currentStop);
					}
				}
			}
		}
	}
}
