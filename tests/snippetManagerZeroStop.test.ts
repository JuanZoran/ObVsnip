import { App } from 'obsidian';
import { SnippetEngine } from '../src/snippetEngine';
import { SnippetManager } from '../src/snippetManager';
import { PluginLogger } from '../src/logger';
import { processSnippetBody } from '../src/snippetBody';
import { getSnippetSessionStack } from '../src/snippetSession';
import { MockEditor, MockEditorView } from './mocks/editor';

jest.mock('../src/editorUtils', () => ({
	getActiveEditor: jest.fn(),
	getEditorView: jest.fn(),
}));

import { getActiveEditor, getEditorView } from '../src/editorUtils';

describe('SnippetManager tab stop transitions', () => {
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

		expect(manager.applySnippetAtCursor(snippet, editor)).toBe(true);

		const selectionFrom = editor.getCursor('from');
		const selectionTo = editor.getCursor('to');
		editor.replaceRange('x', selectionFrom, selectionTo);

		const zeroStop = processed.tabStops.find((stop) => stop.index === 0);
		const jumped = manager.jumpToNextTabStop();

		expect(jumped).toBe(false);
		expect(zeroStop).toBeDefined();
		expect(editor.posToOffset(editor.getCursor())).toBe(zeroStop?.start);
		expect(getSnippetSessionStack(view)).toEqual([]);
	});
});
