import { App } from 'obsidian';
import { SnippetEngine } from '../src/snippetEngine';
import { SnippetManager } from '../src/snippetManager';
import { PluginLogger } from '../src/logger';
import { processSnippetBody } from '../src/snippetBody';
import { getSnippetSessionStack } from '../src/snippetSession';
import {
	popSnippetSessionEffect,
	pushSnippetSessionEffect,
	snippetSessionField,
	updateSnippetSessionEffect,
} from '../src/snippetSession';
import { MockEditor, MockEditorView } from './mocks/editor';
import type { ParsedSnippet } from '../src/types';
import { __noticeMessages } from './mocks/obsidian';
import { EditorState } from '@codemirror/state';

jest.mock('../src/utils/editorUtils', () => ({
	getActiveEditor: jest.fn(),
	getEditorView: jest.fn(),
}));

import { getActiveEditor, getEditorView } from '../src/utils/editorUtils';

describe('SnippetManager tab stop transitions', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	const buildManager = () =>
		new SnippetManager(new App() as any, new SnippetEngine([]), new PluginLogger());

	it('moves the cursor to the implicit $0 after filling a single placeholder', () => {
		const editor = new MockEditor('');
		const view = new MockEditorView('');
		(getActiveEditor as jest.Mock).mockReturnValue(editor);
		(getEditorView as jest.Mock).mockReturnValue(view);

		const processed = processSnippetBody('\\left| ${1} \\right|');
		const snippet = {
			prefix: 'abs',
			body: '\\left| ${1} \\right|',
			description: 'absolute value',
			processedText: processed.text,
			tabStops: processed.tabStops,
			variables: processed.variables,
		};

		const manager = new SnippetManager(
			new App() as any,
			new SnippetEngine([snippet]),
			new PluginLogger()
		);

		expect(manager.applySnippetAtCursor(snippet, editor as any)).toBe(true);

		const selectionFrom = editor.getCursor('from');
		const selectionTo = editor.getCursor('to');
		editor.replaceRange('x', selectionFrom, selectionTo);

		const zeroStop = processed.tabStops.find((stop) => stop.index === 0);
		const jumped = manager.jumpToNextTabStop();

		expect(jumped).toBe(false);
		expect(zeroStop).toBeDefined();
		expect(editor.posToOffset(editor.getCursor())).toBe(zeroStop?.start);
		expect(getSnippetSessionStack(view as any)).toEqual([]);
	});
});

describe('SnippetManager $0 exit scenarios', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	const buildManager = () =>
		new SnippetManager(new App() as any, new SnippetEngine([]), new PluginLogger());

	it('exits snippet mode when $0 already active', () => {
		const manager = buildManager();
		const editor = new MockEditor('');
		let view = new MockEditorView('');
		(getEditorView as jest.Mock).mockReturnValue(view);
		(getActiveEditor as jest.Mock).mockReturnValue(editor);

		const processed = processSnippetBody('value ${1:selected}');
		const snippet = {
			prefix: 'zero',
			body: 'value ${1:selected}',
			description: '',
			processedText: processed.text,
			tabStops: processed.tabStops,
			variables: processed.variables,
		} as ParsedSnippet;

		expect(manager.applySnippetAtCursor(snippet, editor as any)).toBe(true);
		expect(view.state.field(snippetSessionField)?.length).toBeGreaterThan(0);
		view.dispatch({ effects: updateSnippetSessionEffect.of({ currentIndex: 0 }) });

		expect(manager.jumpToNextTabStop()).toBe(false);
		expect(manager.isSnippetActive(editor as any)).toBe(false);
	});

	it('exits snippet mode after editing placeholder before $0', () => {
		const manager = buildManager();
		const editor = new MockEditor('');
		let view = new MockEditorView('');
		(getEditorView as jest.Mock).mockReturnValue(view);
		(getActiveEditor as jest.Mock).mockReturnValue(editor);

		const processed = processSnippetBody('value ${1:selected}');
		const snippet = {
			prefix: 'zero',
			body: 'value ${1:selected}',
			description: '',
			processedText: processed.text,
			tabStops: processed.tabStops,
			variables: processed.variables,
		} as ParsedSnippet;

		expect(manager.applySnippetAtCursor(snippet, editor as any)).toBe(true);
		expect(manager.isSnippetActive(editor as any)).toBe(true);
		const from = editor.getCursor('from');
		const to = editor.getCursor('to');
		expect(editor.getSelection()).toBe('selected');

		editor.replaceRange('edited', from, to);
		const cursorAfter = editor.getCursor();
		expect(cursorAfter.ch).toBe(editor.getText().length);

		expect(manager.jumpToNextTabStop()).toBe(false);
		expect(manager.isSnippetActive(editor as any)).toBe(false);
	});

	it('exits snippet mode after editing placeholder with mapped stops', () => {
		const manager = buildManager();
		const editor = new MockEditor('');
		let view = new MockEditorView('');
		(getEditorView as jest.Mock).mockReturnValue(view);
		(getActiveEditor as jest.Mock).mockReturnValue(editor);

		const processed = processSnippetBody('value ${1:selected}');
		const snippet = {
			prefix: 'zero',
			body: 'value ${1:selected}',
			description: '',
			processedText: processed.text,
			tabStops: processed.tabStops,
			variables: processed.variables,
		} as ParsedSnippet;

		expect(manager.applySnippetAtCursor(snippet, editor as any)).toBe(true);

		const sessionEntry = view.state.field(snippetSessionField)?.slice(-1)[0];
		view = new MockEditorView(editor.getText());
		(getEditorView as jest.Mock).mockReturnValue(view);
		if (sessionEntry) {
			view.dispatch({ effects: pushSnippetSessionEffect.of(sessionEntry) });
		}

		const from = editor.getCursor('from');
		const to = editor.getCursor('to');
		const startOffset = editor.posToOffset(from);
		const endOffset = editor.posToOffset(to);

		editor.replaceRange('edited', from, to);
		view.dispatch({
			changes: {
				from: startOffset,
				to: endOffset,
				insert: 'edited',
			},
		});

		expect(manager.jumpToNextTabStop()).toBe(false);
		expect(manager.isSnippetActive(editor as any)).toBe(false);
	});

	it('exits snippet mode when cursor already sits at implicit $0', () => {
		const manager = buildManager();
		const editor = new MockEditor('');
		const view = new MockEditorView('');
		(getEditorView as jest.Mock).mockReturnValue(view);
		(getActiveEditor as jest.Mock).mockReturnValue(editor);

		const processed = processSnippetBody('value ${1:selected}');
		const snippet = {
			prefix: 'zero',
			body: 'value ${1:selected}',
			description: '',
			processedText: processed.text,
			tabStops: processed.tabStops,
			variables: processed.variables,
		} as ParsedSnippet;

		expect(manager.applySnippetAtCursor(snippet, editor as any)).toBe(true);

		const sessionEntry = view.state.field(snippetSessionField)?.slice(-1)[0];
		view.state = EditorState.create({
			doc: editor.getText(),
			extensions: [snippetSessionField],
		});
		if (sessionEntry) {
			view.dispatch({ effects: pushSnippetSessionEffect.of(sessionEntry) });
		}

		const from = editor.getCursor('from');
		const to = editor.getCursor('to');
		editor.replaceRange('demo', from, to);

		const cursorOffset = editor.posToOffset(editor.getCursor());

		const session = view.state.field(snippetSessionField)?.slice(-1)[0];
		expect(session).toBeDefined();
		const placeholderStop = session!.stops.find((stop) => stop.index === 1);
		const zeroStart = Math.max(
			placeholderStop ? placeholderStop.start + 1 : 0,
			cursorOffset - 2
		);
		const updatedSession = {
			...session!,
			stops: session!.stops.map((stop) =>
				stop.index === 0
					? {
							...stop,
							start: zeroStart,
							end: zeroStart,
					  }
					: stop
			),
		};

		view.dispatch({ effects: popSnippetSessionEffect.of(undefined) });
		view.dispatch({ effects: pushSnippetSessionEffect.of(updatedSession) });

		const zeroStop = updatedSession.stops.find((stop) => stop.index === 0);
		expect(zeroStop).toBeDefined();
		expect(zeroStop?.start).toBe(zeroStart);
		expect(zeroStart).toBeLessThan(cursorOffset);
		expect(cursorOffset).toBeGreaterThanOrEqual(zeroStart);
		expect(editor.posToOffset(editor.getCursor())).toBe(cursorOffset);

		expect(manager.jumpToNextTabStop()).toBe(false);
		expect(manager.isSnippetActive(editor as any)).toBe(false);
	});

	it('jumps to $0 even when placeholder has trailing text', () => {
		const manager = buildManager();
		const editor = new MockEditor('');
		const view = new MockEditorView('');
		(getEditorView as jest.Mock).mockReturnValue(view);
		(getActiveEditor as jest.Mock).mockReturnValue(editor);

		const processed = processSnippetBody('\\left| ${1} \\right|');
		const snippet = {
			prefix: 'abs',
			description: '绝对值 |x|',
			body: '\\left| ${1} \\right|',
			processedText: processed.text,
			tabStops: processed.tabStops,
			variables: processed.variables,
		} as ParsedSnippet;

		expect(manager.applySnippetAtCursor(snippet, editor as any)).toBe(true);
		expect(editor.getSelection()).toBe('');

		const from = editor.getCursor('from');
		const to = editor.getCursor('to');
		editor.replaceRange('demo', from, to);

		expect(editor.getText()).toBe('\\left| demo \\right|');

		expect(manager.jumpToNextTabStop()).toBe(false);
		expect(manager.isSnippetActive(editor as any)).toBe(false);

		expect(manager.jumpToNextTabStop()).toBe(false);
		expect(manager.isSnippetActive(editor as any)).toBe(false);
		expect(editor.getSelection()).not.toBe('demo');
	});

	it('places cursor at inline $0 when only zero stop exists', () => {
		const manager = buildManager();
		const editor = new MockEditor('');
		const view = new MockEditorView('');
		(getEditorView as jest.Mock).mockReturnValue(view);
		(getActiveEditor as jest.Mock).mockReturnValue(editor);

		const processed = processSnippetBody('before $0 after');
		const snippet = {
			prefix: 'inline',
			body: 'before $0 after',
			description: '',
			processedText: processed.text,
			tabStops: processed.tabStops,
			variables: processed.variables,
		};

		expect(manager.applySnippetAtCursor(snippet, editor as any)).toBe(true);
		expect(editor.getText()).toBe(processed.text);

		const stop0 = processed.tabStops.find((stop) => stop.index === 0);
		expect(stop0).toBeDefined();

		const cursor = editor.getCursor();
		const cursorOffset = editor.posToOffset(cursor);
		expect(cursorOffset).toBe(stop0?.start);
		expect(editor.getText().slice(cursorOffset)).toBe(processed.text.slice(cursorOffset));

		expect(manager.jumpToNextTabStop({ silent: true })).toBe(false);
		expect(manager.isSnippetActive(editor as any)).toBe(false);
	});

	it('shouldExitBeforeCachingNextStop reacts to zero-length $0 in real session', () => {
		const processed = processSnippetBody('${1:value} $0');
		const snippet = {
			prefix: 'end',
			body: '${1:value} $0',
			description: '',
			processedText: processed.text,
			tabStops: processed.tabStops,
			variables: processed.variables,
		};
		const editor = new MockEditor('end');
		editor.setCursor({ line: 0, ch: 3 });
		const view = new MockEditorView('end');
		(getActiveEditor as jest.Mock).mockReturnValue(editor);
		(getEditorView as jest.Mock).mockReturnValue(view);

		const engine = new SnippetEngine([snippet]);
		const manager = new SnippetManager(new App() as any, engine, new PluginLogger());
		manager.expandSnippet();

		// move to end where zero-length $0 resides
		editor.setCursor({ line: 0, ch: editor.getText().length });
		// first jump attempts to reach $1 but should exit because $0 already satisfied
		expect(manager.jumpToNextTabStop()).toBe(false);
		expect(manager.isSnippetActive(editor as any)).toBe(false);
	});

	it('exits snippet mode when $0 lies inside the previous placeholder', () => {
		const manager = buildManager();
		const editor = new MockEditor('');
		const view = new MockEditorView('');
		(getEditorView as jest.Mock).mockReturnValue(view);
		(getActiveEditor as jest.Mock).mockReturnValue(editor);

		const processed = processSnippetBody('value ${1:selected}');
		const snippet = {
			prefix: 'zero',
			body: 'value ${1:selected}',
			description: 'border case for zero stop',
			processedText: processed.text,
			tabStops: processed.tabStops,
			variables: processed.variables,
		} as ParsedSnippet;

		expect(manager.applySnippetAtCursor(snippet, editor as any)).toBe(true);

		const from = editor.getCursor('from');
		const to = editor.getCursor('to');
		editor.replaceRange('demo', from, to);

		const session = view.state.field(snippetSessionField)?.slice(-1)[0];
		expect(session).toBeDefined();
		const updatedSession = {
			...session!,
			stops: session!.stops.map((stop) => {
				if (stop.index === 0) {
					const placeholder = session!.stops.find(
						(s) => s.index === 1
					);
					const insidePoint = Math.max(
						(placeholder?.start ?? stop.start) + 1,
						(placeholder?.end ?? stop.end) - 1
					);
					return {
						...stop,
						start: insidePoint,
						end: insidePoint,
					};
				}
				return stop;
			}),
		};

		view.dispatch({ effects: popSnippetSessionEffect.of(undefined) });
		view.dispatch({ effects: pushSnippetSessionEffect.of(updatedSession) });

		const zeroStop = updatedSession.stops.find((stop) => stop.index === 0);
		const placeholderStop = updatedSession.stops.find(
			(stop) => stop.index === 1
		);
		expect(zeroStop).toBeDefined();
		expect(placeholderStop).toBeDefined();
		expect(zeroStop?.start).toBeLessThan(placeholderStop?.end ?? Infinity);

		expect(manager.jumpToNextTabStop()).toBe(false);
		expect(manager.isSnippetActive(editor as any)).toBe(false);
	});

	it('exits snippet mode when $0 lies right after the previous placeholder', () => {
		const manager = buildManager();
		const editor = new MockEditor('');
		let view = new MockEditorView('');
		(getEditorView as jest.Mock).mockReturnValue(view);
		(getActiveEditor as jest.Mock).mockReturnValue(editor);

		const processed = processSnippetBody('value ${1:selected}');
		const snippet = {
			prefix: 'zero',
			body: 'value ${1:selected}',
			description: 'collapsed caret edge case',
			processedText: processed.text,
			tabStops: processed.tabStops,
			variables: processed.variables,
		} as ParsedSnippet;

		expect(manager.applySnippetAtCursor(snippet, editor as any)).toBe(true);

		const sessionEntry = view.state.field(snippetSessionField)?.slice(-1)[0];
		view = new MockEditorView(editor.getText());
		(getEditorView as jest.Mock).mockReturnValue(view);
		if (sessionEntry) {
			view.dispatch({ effects: pushSnippetSessionEffect.of(sessionEntry) });
		}

		const from = editor.getCursor('from');
		const to = editor.getCursor('to');
		const startOffset = editor.posToOffset(from);
		const endOffset = editor.posToOffset(to);
		editor.replaceRange('demo', from, to);
		view.dispatch({
			changes: {
				from: startOffset,
				to: endOffset,
				insert: 'demo',
			},
		});

		expect(manager.jumpToNextTabStop()).toBe(false);
		expect(manager.isSnippetActive(editor as any)).toBe(false);
	});

	it('never focuses $0 when it ends up adjacent to the edited placeholder', () => {
		const manager = buildManager();
		const editor = new MockEditor('');
		let view = new MockEditorView('');
		(getEditorView as jest.Mock).mockReturnValue(view);
		(getActiveEditor as jest.Mock).mockReturnValue(editor);

		const processed = processSnippetBody('value ${1:selected}');
		const snippet = {
			prefix: 'zero',
			body: 'value ${1:selected}',
			description: 'ensure no jump after placeholder edit',
			processedText: processed.text,
			tabStops: processed.tabStops,
			variables: processed.variables,
		} as ParsedSnippet;

		expect(manager.applySnippetAtCursor(snippet, editor as any)).toBe(true);

		const sessionEntry = view.state.field(snippetSessionField)?.slice(-1)[0];
		view = new MockEditorView(editor.getText());
		(getEditorView as jest.Mock).mockReturnValue(view);
		if (sessionEntry) {
			view.dispatch({ effects: pushSnippetSessionEffect.of(sessionEntry) });
		}

		const from = editor.getCursor('from');
		const to = editor.getCursor('to');
		const startOffset = editor.posToOffset(from);
		const endOffset = editor.posToOffset(to);
		editor.replaceRange('demo', from, to);
		view.dispatch({
			changes: {
				from: startOffset,
				to: endOffset,
				insert: 'demo',
			},
		});

		const cursorAfterEdit = editor.getCursor();
		const cursorOffsetAfterEdit = editor.posToOffset(cursorAfterEdit);

		expect(manager.jumpToNextTabStop({ silent: true })).toBe(false);
		expect(manager.isSnippetActive(editor as any)).toBe(false);
		expect(editor.posToOffset(editor.getCursor())).toBe(cursorOffsetAfterEdit);
	});

	it('exits snippet mode when typing inside placeholder pushes $0 into the typed range', () => {
		const manager = buildManager();
		const editor = new MockEditor('');
		let view = new MockEditorView('');
		(getEditorView as jest.Mock).mockReturnValue(view);
		(getActiveEditor as jest.Mock).mockReturnValue(editor);

		const processed = processSnippetBody('value ${1:selected}');
		const snippet = {
			prefix: 'zero',
			body: 'value ${1:selected}',
			description: 'typing inside placeholder should avoid $0',
			processedText: processed.text,
			tabStops: processed.tabStops,
			variables: processed.variables,
		} as ParsedSnippet;

		expect(manager.applySnippetAtCursor(snippet, editor as any)).toBe(true);
		const session = view.state.field(snippetSessionField)?.slice(-1)[0];
		view = new MockEditorView(editor.getText());
		(getEditorView as jest.Mock).mockReturnValue(view);
		if (session) {
			view.dispatch({ effects: pushSnippetSessionEffect.of(session) });
		}
		expect(session).toBeDefined();
		const placeholderStop = session!.stops.find((stop) => stop.index === 1);
		expect(placeholderStop).toBeDefined();
		const editOffset = placeholderStop!.start + 2;
		const editPos = editor.offsetToPos(editOffset);
		editor.setCursor(editPos);
		const cursorBefore = editor.getCursor();

		editor.replaceRange('X', cursorBefore, cursorBefore);
		const changeStart = editOffset;
		view.dispatch({
			changes: {
				from: changeStart,
				to: changeStart,
				insert: 'X',
			},
		});

		expect(manager.jumpToNextTabStop({ silent: true })).toBe(false);
		expect(manager.isSnippetActive(editor as any)).toBe(false);
		const finalCursor = editor.getCursor();
		expect(finalCursor).toEqual(editor.offsetToPos(changeStart + 1));
	});

	it('jumpToNextTabStop silent exits at $0 without Notice', () => {
		const processed = processSnippetBody('${1:stop} $0');
		const snippet = {
			prefix: 'flow',
			body: '${1:stop} $0',
			description: '',
			processedText: processed.text,
			tabStops: processed.tabStops,
			variables: processed.variables,
		};
		const editor = new MockEditor('flow');
		editor.setCursor({ line: 0, ch: 4 });
		const view = new MockEditorView('flow');
		(getActiveEditor as jest.Mock).mockReturnValue(editor);
		(getEditorView as jest.Mock).mockReturnValue(view);

		const engine = new SnippetEngine([snippet]);
		const manager = new SnippetManager(new App() as any, engine, new PluginLogger());
		manager.expandSnippet();
		__noticeMessages.length = 0;
		expect(manager.jumpToNextTabStop({ silent: true })).toBe(false);
		expect(__noticeMessages.length).toBe(0);
	});
});
