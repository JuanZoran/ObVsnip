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
import { __noticeMessages } from './mocks/obsidian';
import { EditorState } from '@codemirror/state';

jest.mock('../src/utils/editorUtils', () => ({
	getActiveEditor: jest.fn(),
	getEditorView: jest.fn(),
}));

import { getActiveEditor, getEditorView } from '../src/utils/editorUtils';

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

	it('forceExitSnippetMode clears active sessions', () => {
		const logger = { debug: jest.fn() } as unknown as PluginLogger;
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
