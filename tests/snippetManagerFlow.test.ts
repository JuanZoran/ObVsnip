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

	it('expands snippet, navigates tab stops, cycles choices, and exits', () => {
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
		let stack = getSnippetSessionStack(view as any);
		expect(stack?.[0].currentIndex).toBe(1);

		expect(manager.jumpToNextTabStop()).toBe(true);
		stack = getSnippetSessionStack(view as any);
		expect(stack?.[0].currentIndex).toBe(2);

		expect(manager.cycleChoiceAtCurrentStop()).toBe(true);
		expect(editor.getText()).toContain('No!');

		expect(manager.jumpToNextTabStop()).toBe(false);
		stack = getSnippetSessionStack(view as any);
		expect(stack?.length ?? 0).toBe(0);
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
