import { EditorState, type TransactionSpec } from '@codemirror/state';
import { snippetSessionField } from '../../src/snippetSession';

export class MockEditor {
	private text: string[];
	private cursor = { line: 0, ch: 0 };
	private selection: { anchor: { line: number; ch: number }; head: { line: number; ch: number } };

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
}

export class MockEditorView {
	state: EditorState;

	constructor(initialText = '') {
		this.state = EditorState.create({
			doc: initialText,
			extensions: [snippetSessionField],
		});
	}

	dispatch(spec: TransactionSpec): void {
		this.state = this.state.update(spec).state;
	}
}
