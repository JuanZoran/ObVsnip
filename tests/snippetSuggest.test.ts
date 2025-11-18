import { SnippetCompletionMenu } from '../src/snippetSuggest';
import { MockEditor } from './mocks/editor';
import { PluginLogger } from '../src/logger';

jest.mock('../src/editorUtils', () => ({
	getActiveEditor: jest.fn(),
	getEditorView: jest.fn().mockReturnValue(null),
}));

const createApp = () => ({ workspace: { getActiveViewOfType: () => null } }) as any;

const createSnippet = (prefix: string, body: string, description?: string, priority?: number) => ({
	prefix,
	body,
	description,
	processedText: body,
	tabStops: [],
	priority,
});

const attachDomHelpers = () => {
	const proto = HTMLElement.prototype as any;
	if (!proto.createEl) {
		proto.createEl = function (tag: string, options?: { cls?: string; text?: string }) {
			const el = document.createElement(tag);
			if (options?.cls) el.className = options.cls;
			if (options?.text) el.textContent = options.text;
			this.appendChild(el);
			return el;
		};
	}
	if (!proto.createDiv) {
		proto.createDiv = function (options?: { cls?: string; text?: string }) {
			return this.createEl('div', options);
		};
	}
	if (!proto.createSpan) {
		proto.createSpan = function (options?: { cls?: string; text?: string }) {
			return this.createEl('span', options);
		};
	}
	if (!proto.empty) {
		proto.empty = function () {
			this.textContent = '';
		};
	}
	if (!proto.toggleClass) {
		proto.toggleClass = function (cls: string, force?: boolean) {
			this.classList.toggle(cls, force);
		};
	}
	if (!proto.setText) {
		proto.setText = function (text: string) {
			this.textContent = text;
			return this;
		};
	}
	if (!proto.scrollIntoView) {
		proto.scrollIntoView = () => {};
	}
};

attachDomHelpers();

describe('SnippetCompletionMenu UI flow', () => {
	let menu: SnippetCompletionMenu;
	let editor: MockEditor;
	let snippets: any[];
	let manager: { applySnippetAtCursor: jest.Mock };

	beforeEach(() => {
		editor = new MockEditor('');
		snippets = [
			createSnippet('log', 'console.log()', 'Log', 1),
			createSnippet('alert', 'alert()', 'Alert', 0),
			createSnippet('apple', 'fruit', 'Fruit', 2),
		];
		manager = { applySnippetAtCursor: jest.fn().mockReturnValue(true) } as any;
		menu = new SnippetCompletionMenu(createApp(), {
			getSnippets: () => snippets,
			manager,
			logger: new PluginLogger(),
			getSortMode: () => 'smart',
		});
		document.body.innerHTML = '';
	});

	afterEach(() => {
		menu.close();
		document.body.innerHTML = '';
	});

	it('filters and sorts snippets based on prefix', () => {
		expect(menu.open(editor as any, 'ap')).toBe(true);
		const items = document.querySelectorAll('.snippet-completion-item');
		expect(items.length).toBe(1);
		expect(items[0].textContent).toContain('apple');
		menu.close();
	});

	it('handles keyboard navigation and accepts selection', () => {
		expect(menu.open(editor as any, '')).toBe(true);
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
		expect(menu.isOpen()).toBe(false);
		expect(manager.applySnippetAtCursor).toHaveBeenCalled();
	});

	it('respects prefix-length sort mode', () => {
		const prefixMenu = new SnippetCompletionMenu(createApp(), {
			getSnippets: () => snippets,
			manager,
			logger: new PluginLogger(),
			getSortMode: () => 'prefix-length',
		});
		expect(prefixMenu.open(editor as any, '')).toBe(true);
		const titles = Array.from(document.querySelectorAll('.snippet-completion-title')).map((el) => el.textContent);
		expect(titles[0]).toBe('log');
		prefixMenu.close();
	});
});
