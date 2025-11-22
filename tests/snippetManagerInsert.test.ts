import { App } from 'obsidian';
import { SnippetManager } from '../src/snippetManager';
import { SnippetEngine } from '../src/snippetEngine';
import { PluginLogger } from '../src/logger';
import {
	popSnippetSessionEffect,
	pushSnippetSessionEffect,
	snippetSessionField,
	updateSnippetSessionEffect,
} from '../src/snippetSession';
import { processSnippetBody } from '../src/snippetBody';
import { MockEditor, MockEditorView } from './mocks/editor';
import type { ParsedSnippet } from '../src/types';
import { __noticeMessages } from 'obsidian';
import { EditorState } from '@codemirror/state';

jest.mock('../src/editorUtils', () => ({
	getActiveEditor: jest.fn(),
	getEditorView: jest.fn(),
}));

import { getActiveEditor, getEditorView } from '../src/editorUtils';

describe('SnippetManager insertion and jumping edge cases', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	const buildManager = () =>
		new SnippetManager(new App() as any, new SnippetEngine([]), new PluginLogger());

	it('handles snippet without explicit tab stops via implicit $0', () => {
		const manager = buildManager();
		const editor = new MockEditor('');
		let view = new MockEditorView('');
		(getEditorView as jest.Mock).mockReturnValue(view);
		(getActiveEditor as jest.Mock).mockReturnValue(editor);

		const snippet = {
			prefix: 'plain',
			body: 'plain',
			description: '',
			processedText: 'plain',
			tabStops: [],
		} as ParsedSnippet;

		expect(manager.applySnippetAtCursor(snippet, editor as any)).toBe(true);
		expect(editor.getText()).toBe('plain');

		expect(manager.jumpToNextTabStop({ silent: true })).toBe(false);
		expect(manager.isSnippetActive(editor as any)).toBe(false);
		expect(editor.getCursor()).toEqual({ line: 0, ch: 5 });
	});

	it('selects choice tab stop after insertion', () => {
	const manager = buildManager();
	const editor = new MockEditor('');
	let view = new MockEditorView('');
		(getEditorView as jest.Mock).mockReturnValue(view);
		(getActiveEditor as jest.Mock).mockReturnValue(editor);

		const processed = processSnippetBody('${1|Yes,No|} done');
		const snippet = {
			prefix: 'choice',
			body: '${1|Yes,No|} done',
			description: '',
			processedText: processed.text,
			tabStops: processed.tabStops,
			variables: processed.variables,
		} as ParsedSnippet;

		expect(manager.applySnippetAtCursor(snippet, editor as any)).toBe(true);
		expect(editor.getSelection()).toBe('Yes');
		expect(manager.isSnippetActive(editor as any)).toBe(true);
		expect(manager.cycleChoiceAtCurrentStop()).toBe(true);
		expect(editor.getSelection()).toBe('No');
	});

	it('handles zero-length tab stop by placing caret', () => {
	const manager = buildManager();
	const editor = new MockEditor('');
	let view = new MockEditorView('');
		(getEditorView as jest.Mock).mockReturnValue(view);

		const processed = processSnippetBody('${1}${0}');
		const snippet = {
			prefix: 'zero',
			body: '${1}${0}',
			description: '',
			processedText: processed.text,
			tabStops: processed.tabStops,
			variables: processed.variables,
		} as ParsedSnippet;

		expect(manager.applySnippetAtCursor(snippet, editor as any)).toBe(true);
		const from = editor.getCursor('from');
		const to = editor.getCursor('to');
		expect(from).toEqual(to);
	});

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

	it('keeps nested tab stops valid and updates session after edits', () => {
		const manager = buildManager();
		const editor = new MockEditor('');
		let view = new MockEditorView('');
		(getEditorView as jest.Mock).mockReturnValue(view);
		(getActiveEditor as jest.Mock).mockReturnValue(editor);

		const processed = processSnippetBody('outer ${1:${2|Yes,No|} inner} end');
		const snippet = {
			prefix: 'nested',
			body: 'outer ${1:${2|Yes,No|} inner} end',
			description: '',
			processedText: processed.text,
			tabStops: processed.tabStops,
			variables: processed.variables,
		} as ParsedSnippet;

		expect(manager.applySnippetAtCursor(snippet, editor as any)).toBe(true);

		const sessionEntry = view.state.field(snippetSessionField)?.slice(-1)[0];
		const syncedView = new MockEditorView(editor.getText());
		(getEditorView as jest.Mock).mockReturnValue(syncedView);
		if (sessionEntry) {
			syncedView.dispatch({ effects: pushSnippetSessionEffect.of(sessionEntry) });
		}

		view = syncedView;

		const beforeSession = view.state.field(snippetSessionField)?.slice(-1)[0];
		const innerStop = beforeSession?.stops.find((stop) => stop.index === 2);
		expect(innerStop).toBeDefined();

		const insertText = 'PRE-';
		editor.replaceRange(insertText, editor.offsetToPos(innerStop!.start), editor.offsetToPos(innerStop!.start));
		view.dispatch({
			changes: {
				from: innerStop!.start,
				to: innerStop!.start,
				insert: insertText,
			},
		});

		const afterSession = view.state.field(snippetSessionField)?.slice(-1)[0];
		const updatedInnerStop = afterSession?.stops.find((stop) => stop.index === 2);
		// The start remains anchored (mapPos uses assoc -1), but the end should grow.
		expect(updatedInnerStop?.start).toBe(innerStop!.start);
		expect(updatedInnerStop?.end).toBe(innerStop!.end + insertText.length);
		expect(manager.isSnippetActive(editor as any)).toBe(true);

		const innerFrom = editor.offsetToPos(updatedInnerStop?.start ?? 0);
		const innerTo = editor.offsetToPos(updatedInnerStop?.end ?? 0);
		editor.setSelection(innerFrom, innerTo);

		expect(manager.isSnippetActive(editor as any)).toBe(true);
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

	it('jumpToPrevTabStop exits snippet mode when reaching start', () => {
		const processed = processSnippetBody('${1:first} ${2:second} $0');
		const snippet = {
			prefix: 'prev',
			body: '${1:first} ${2:second} $0',
			description: '',
			processedText: processed.text,
			tabStops: processed.tabStops,
			variables: processed.variables,
		};

		const editor = new MockEditor('prev');
		editor.setCursor({ line: 0, ch: 4 });
		const view = new MockEditorView('prev');
		(getActiveEditor as jest.Mock).mockReturnValue(editor);
		(getEditorView as jest.Mock).mockReturnValue(view);

		const engine = new SnippetEngine([snippet]);
		const manager = new SnippetManager(new App() as any, engine, new PluginLogger());

		manager.expandSnippet();
		manager.jumpToNextTabStop();
		expect(manager.jumpToPrevTabStop()).toBe(true);
		expect(manager.jumpToPrevTabStop()).toBe(false);
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

	it('forceExitSnippetMode clears active sessions', () => {
		const logger = { debug: jest.fn() } as PluginLogger;
		const manager = new SnippetManager({} as any, new SnippetEngine([]), logger);
		const editor = new MockEditor('');
		const view = new MockEditorView('');
		(getActiveEditor as jest.Mock).mockReturnValue(editor);
		(getEditorView as jest.Mock).mockReturnValue(view);
		view.dispatch({
			effects: pushSnippetSessionEffect.of({
				currentIndex: 1,
				stops: [{ index: 1, start: 0, end: 0 }],
			}),
		});

		const result = manager.forceExitSnippetMode(view as any);
		expect(result).toBe(true);
		expect(manager.isSnippetActive(editor as any)).toBe(false);
		expect(logger.debug).toHaveBeenCalledWith(
			'manager',
			expect.stringContaining('Exited snippet mode')
		);
	});

	it('forceExitSnippetMode returns false without view', () => {
		(getActiveEditor as jest.Mock).mockReturnValue(null);
		const manager = buildManager();
		expect(manager.forceExitSnippetMode(undefined)).toBe(false);
	});

	it('forceExitSnippetMode returns false when stack empty', () => {
		const manager = buildManager();
		const view = new MockEditorView('');
		expect(manager.forceExitSnippetMode(view as any)).toBe(false);
	});

	it('applySnippetAtCursor warns when no editor', () => {
		const manager = buildManager();
		(getActiveEditor as jest.Mock).mockReturnValue(null);
		const snippet = { prefix: 'a', body: 'a', processedText: 'a', tabStops: [] } as ParsedSnippet;
		expect(manager.applySnippetAtCursor(snippet)).toBe(false);
	});

	it('applySnippetAtCursor uses current selection range', () => {
		const manager = buildManager();
		const editor = new MockEditor('text');
		editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 4 });
		const insertSpy = jest.spyOn(manager as any, 'insertSnippet').mockReturnValue(true);
		const snippet = { prefix: 's', body: 's', processedText: 's', tabStops: [] } as ParsedSnippet;

		expect(manager.applySnippetAtCursor(snippet, editor as any)).toBe(true);
		expect(insertSpy).toHaveBeenCalledWith(editor, snippet, { line: 0, ch: 0 }, { line: 0, ch: 4 });
	});

	it('jumpToNextTabStop silent mode skips Notice', () => {
		const manager = buildManager();
		const editor = new MockEditor('');
		(getActiveEditor as jest.Mock).mockReturnValue(editor);
		__noticeMessages.length = 0;
		expect(manager.jumpToNextTabStop({ silent: true })).toBe(false);
		expect(__noticeMessages.length).toBe(0);
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

	it('jumpToNextTabStop exits nested sessions and continues', () => {
		const editor = new MockEditor('abcdef');
		const view = new MockEditorView('abcdef');
		(getActiveEditor as jest.Mock).mockReturnValue(editor);
		(getEditorView as jest.Mock).mockReturnValue(view);

		const manager = buildManager();
		view.dispatch({
			effects: pushSnippetSessionEffect.of({
				currentIndex: 1,
				stops: [
					{ index: 1, start: 0, end: 2 },
					{ index: 0, start: 2, end: 2 },
				],
			}),
		});
		view.dispatch({
			effects: pushSnippetSessionEffect.of({
				currentIndex: 1,
				stops: [
					{ index: 1, start: 2, end: 4 },
					{ index: 0, start: 4, end: 4 },
				],
			}),
		});
		editor.setCursor({ line: 0, ch: 4 });
		__noticeMessages.length = 0;

		const result = manager.jumpToNextTabStop({ silent: true });
		expect(result).toBe(false);
		expect(manager.isSnippetActive(editor as any)).toBe(false);
		expect(__noticeMessages.length).toBe(0);
	});

	it('cycleChoiceAtCurrentStop returns false without session', () => {
		const manager = buildManager();
		const editor = new MockEditor('');
		const view = new MockEditorView('');
		(getActiveEditor as jest.Mock).mockReturnValue(editor);
		(getEditorView as jest.Mock).mockReturnValue(view);
		__noticeMessages.length = 0;
		expect(manager.cycleChoiceAtCurrentStop()).toBe(false);
		expect(__noticeMessages.length).toBe(0);
	});

	it('cycleChoiceAtCurrentStop returns false when stop lacks choices', () => {
		const manager = buildManager();
		const editor = new MockEditor('');
		const view = new MockEditorView('');
		(getActiveEditor as jest.Mock).mockReturnValue(editor);
		(getEditorView as jest.Mock).mockReturnValue(view);
		view.dispatch({
			effects: pushSnippetSessionEffect.of({
				currentIndex: 1,
				stops: [{ index: 1, start: 0, end: 0 }],
			}),
		});
		__noticeMessages.length = 0;
		expect(manager.cycleChoiceAtCurrentStop()).toBe(false);
		expect(__noticeMessages.length).toBe(0);
	});
});
