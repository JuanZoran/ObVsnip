import { App } from 'obsidian';
import { SnippetEngine } from '../src/snippetEngine';
import { SnippetManager } from '../src/snippetManager';
import { PluginLogger } from '../src/logger';
import { processSnippetBody } from '../src/snippetBody';
import { MockEditor, MockEditorView } from './mocks/editor';

jest.mock('../src/editorUtils', () => ({
	getActiveEditor: jest.fn(),
	getEditorView: jest.fn(),
}));

import { getActiveEditor, getEditorView } from '../src/editorUtils';

describe('SnippetManager core flow', () => {
	const setupSnippet = () => {
		const processed = processSnippetBody('Hello ${1:World} ${2|Yes,No|}! $0');
		return {
			prefix: 'foo',
			body: 'Hello ${1:World} ${2|Yes,No|}! $0',
			description: '',
			processedText: processed.text,
			tabStops: processed.tabStops,
			variables: processed.variables,
		};
	};

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('expands snippet and selects the first tab stop', () => {
		const editor = new MockEditor('foo');
		editor.setCursor({ line: 0, ch: 3 });
		const view = new MockEditorView('foo');
		(getActiveEditor as jest.Mock).mockReturnValue(editor);
		(getEditorView as jest.Mock).mockReturnValue(view);

		const snippet = setupSnippet();
		const engine = new SnippetEngine([snippet]);
		const manager = new SnippetManager(new App() as any, engine, new PluginLogger());

		expect(manager.expandSnippet()).toBe(true);
		expect(editor.getText()).toContain('Hello World Yes');
		expect(editor.getSelection()).toBe('World');
		expect(manager.isSnippetActive(editor as any)).toBe(true);
	});

	it('navigates tab stops, cycles choices, and exits snippet mode', () => {
		const editor = new MockEditor('foo');
		editor.setCursor({ line: 0, ch: 3 });
		const view = new MockEditorView('foo');
		(getActiveEditor as jest.Mock).mockReturnValue(editor);
		(getEditorView as jest.Mock).mockReturnValue(view);

		const snippet = setupSnippet();
		const engine = new SnippetEngine([snippet]);
		const manager = new SnippetManager(new App() as any, engine, new PluginLogger());

		expect(manager.expandSnippet()).toBe(true);
		expect(manager.jumpToNextTabStop()).toBe(true);
		expect(editor.getSelection()).toBe('Yes');

		expect(manager.cycleChoiceAtCurrentStop()).toBe(true);
		expect(editor.getSelection()).toBe('No');

		expect(manager.jumpToNextTabStop()).toBe(false);
		expect(manager.isSnippetActive(editor as any)).toBe(false);
	});

	it('returns false when no active editor is available', () => {
		(getActiveEditor as jest.Mock).mockReturnValue(null);
		const manager = new SnippetManager(new App() as any, new SnippetEngine([]), new PluginLogger());
		expect(manager.expandSnippet()).toBe(false);
		expect(manager.jumpToNextTabStop()).toBe(false);
	});

	it('jumpToNextTabStop without snippet mode returns false', () => {
		const editor = new MockEditor('text');
		(getActiveEditor as jest.Mock).mockReturnValue(editor);
		const manager = new SnippetManager(new App() as any, new SnippetEngine([]), new PluginLogger());
		expect(manager.jumpToNextTabStop()).toBe(false);
	});

	it('cycleChoiceAtCurrentStop is a no-op when stop lacks choices', () => {
		const processed = processSnippetBody('${1:Text}');
		const snippet = {
			prefix: 'single',
			body: '${1:Text}',
			description: '',
			processedText: processed.text,
			tabStops: processed.tabStops,
			variables: processed.variables,
		};
		const editor = new MockEditor('single');
		editor.setCursor({ line: 0, ch: 6 });
		const view = new MockEditorView('single');
		(getActiveEditor as jest.Mock).mockReturnValue(editor);
		(getEditorView as jest.Mock).mockReturnValue(view);

		const engine = new SnippetEngine([snippet]);
		const manager = new SnippetManager(new App() as any, engine, new PluginLogger());
		expect(manager.expandSnippet()).toBe(true);
		expect(manager.cycleChoiceAtCurrentStop()).toBe(false);
	});
});
