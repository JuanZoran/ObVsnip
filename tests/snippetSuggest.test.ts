import { SnippetCompletionMenu, formatSnippetPreview } from '../src/snippetSuggest';
import { MockEditor } from './mocks/editor';
import { PluginLogger } from '../src/logger';
import { DEFAULT_RANKING_ALGORITHMS } from '../src/rankingConfig';
import type { RankingAlgorithmSetting } from '../src/types';

jest.mock('../src/editorUtils', () => ({
	getActiveEditor: jest.fn(),
	getEditorView: jest.fn().mockReturnValue(null),
}));

const rankingAlgorithmNames = {
	"fuzzy-match": "Fuzzy match",
	"prefix-length": "Prefix length",
	alphabetical: "Alphabetical",
	"usage-frequency": "Usage frequency",
	"original-order": "Original order",
};

const createApp = () => ({ workspace: { getActiveViewOfType: () => null } }) as any;

const createSnippet = (
	prefix: string,
	body: string,
	description?: string,
	priority?: number,
	hide?: boolean
) => ({
	prefix,
	body,
	description,
	processedText: body,
	tabStops: [],
	priority,
	hide,
});

type DomHelperName = 'createEl' | 'createDiv' | 'createSpan' | 'empty' | 'toggleClass' | 'setText' | 'scrollIntoView';
const DOM_HELPERS: DomHelperName[] = [
	'createEl',
	'createDiv',
	'createSpan',
	'empty',
	'toggleClass',
	'setText',
	'scrollIntoView',
];

const defineDomHelpers = (): () => void => {
	const proto = HTMLElement.prototype as Record<string, any>;
	const originals: Partial<Record<DomHelperName, any>> = {};

	DOM_HELPERS.forEach((name) => {
		originals[name] = proto[name];
	});

	if (!proto.createEl) {
		proto.createEl = function (tag: string, options?: { cls?: string; text?: string }) {
			const el = document.createElement(tag);
			if (options?.cls) el.className = options.cls;
			if (options?.text) el.textContent = options.text;
			this.appendChild(el);
			return el;
		};
	}

	proto.createDiv = function (options?: { cls?: string; text?: string }) {
		return this.createEl('div', options);
	};
	proto.createSpan = function (options?: { cls?: string; text?: string }) {
		return this.createEl('span', options);
	};
	proto.empty = function () {
		this.textContent = '';
	};
	proto.toggleClass = function (cls: string, force?: boolean) {
		this.classList.toggle(cls, force);
	};
	proto.setText = function (text: string) {
		this.textContent = text;
		return this;
	};
	proto.scrollIntoView = () => {};

	return () => {
		DOM_HELPERS.forEach((name) => {
			if (originals[name] === undefined) {
				delete proto[name];
			} else {
				proto[name] = originals[name];
			}
		});
	};
};

const cloneDefaultRanking = (): RankingAlgorithmSetting[] =>
	DEFAULT_RANKING_ALGORITHMS.map((entry) => ({ ...entry }));

describe('SnippetCompletionMenu UI flow', () => {
	let menu: SnippetCompletionMenu;
	let editor: MockEditor;
	let snippets: any[];
	let manager: { applySnippetAtCursor: jest.Mock };
	let restoreDomHelpers: (() => void) | null = null;

	beforeEach(() => {
		restoreDomHelpers = defineDomHelpers();
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
			getRankingAlgorithms: () => cloneDefaultRanking(),
			getUsageCounts: () => new Map(),
			getRankingAlgorithmNames: () => rankingAlgorithmNames,
		});
		document.body.innerHTML = '';
	});

	afterEach(() => {
		menu.close();
		document.body.innerHTML = '';

		restoreDomHelpers?.();
		restoreDomHelpers = null;
	});

	it('filters and sorts snippets based on prefix', () => {
		expect(menu.open(editor as any, 'ap')).toBe(true);
		const items = document.querySelectorAll('.snippet-completion-item');
		expect(items.length).toBe(1);
		expect(items[0].textContent).toContain('apple');
		menu.close();
	});

	it('includes fuzzy matches even when prefix does not start with the query', () => {
		snippets = [
			createSnippet('html link', 'body', 'Link'),
			createSnippet('helper', 'body', 'Assistant'),
		];
		const ranking: RankingAlgorithmSetting[] = [
			{ id: 'fuzzy-match', enabled: true },
			{ id: 'original-order', enabled: true },
		];
		menu = new SnippetCompletionMenu(createApp(), {
			getSnippets: () => snippets,
			manager,
			logger: new PluginLogger(),
			getRankingAlgorithms: () => ranking,
			getUsageCounts: () => new Map(),
			getRankingAlgorithmNames: () => rankingAlgorithmNames,
		});
		expect(menu.open(editor as any, 'hl')).toBe(true);
		const titles = Array.from(document.querySelectorAll('.snippet-completion-title')).map((el) => el.textContent);
		expect(titles).toContain('html link');
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
		const prefixRanking: RankingAlgorithmSetting[] = [
			{ id: "prefix-length", enabled: true },
			{ id: "original-order", enabled: true },
		];
		const prefixMenu = new SnippetCompletionMenu(createApp(), {
			getSnippets: () => snippets,
			manager,
			logger: new PluginLogger(),
			getRankingAlgorithms: () => prefixRanking,
			getUsageCounts: () => new Map(),
			getRankingAlgorithmNames: () => rankingAlgorithmNames,
		});
		expect(prefixMenu.open(editor as any, '')).toBe(true);
		const titles = Array.from(document.querySelectorAll('.snippet-completion-title')).map((el) => el.textContent);
		expect(titles[0]).toBe('log');
		prefixMenu.close();
	});

	it('matches long prefixes even when prefix window is limited', () => {
		snippets = [createSnippet('snippet long', 'body')];
		editor = new MockEditor('snippet long');
		editor.setCursor({ line: 0, ch: 'snippet long'.length });
		menu = new SnippetCompletionMenu(createApp(), {
			getSnippets: () => snippets,
			manager,
			logger: new PluginLogger(),
			getRankingAlgorithms: () => [
				{ id: "original-order", enabled: true },
			],
			getUsageCounts: () => new Map(),
			getRankingAlgorithmNames: () => rankingAlgorithmNames,
			getPrefixInfo: () => ({ minLength: 1, maxLength: 5 }),
		});

		expect(menu.open(editor as any, '')).toBe(true);

		const emptyState = document.querySelector('.snippet-completion-empty');
		expect(emptyState).toBeNull();

		const titles = Array.from(document.querySelectorAll('.snippet-completion-title')).map((el) => el.textContent);
		expect(titles).toContain('snippet long');
	});

	it('matches prefixes that span multiple lines', () => {
		const prefix = 'snippet multi';
		const bodyText = `${prefix}\nsecond line`;
		snippets = [createSnippet(prefix, 'body')];
		editor = new MockEditor(bodyText);
		editor.setCursor({ line: 1, ch: 'second line'.length });
		menu = new SnippetCompletionMenu(createApp(), {
			getSnippets: () => snippets,
			manager,
			logger: new PluginLogger(),
			getRankingAlgorithms: () => [
				{ id: "original-order", enabled: true },
			],
			getUsageCounts: () => new Map(),
			getRankingAlgorithmNames: () => rankingAlgorithmNames,
			getPrefixInfo: () => ({ minLength: 1, maxLength: 6 }),
		});

		expect(menu.open(editor as any, '')).toBe(true);

		const emptyState = document.querySelector('.snippet-completion-empty');
		expect(emptyState).toBeNull();

		const titles = Array.from(document.querySelectorAll('.snippet-completion-title')).map((el) => el.textContent);
		expect(titles).toContain(prefix);
	});

	it('skips hidden snippets when falling back to all snippets', () => {
		snippets = [
			createSnippet('hidden-snippet', 'body', 'Hidden', undefined, true),
			createSnippet('visible-snippet', 'body', 'Visible'),
		];
		menu = new SnippetCompletionMenu(createApp(), {
			getSnippets: () => snippets,
			manager,
			logger: new PluginLogger(),
			getRankingAlgorithms: () => cloneDefaultRanking(),
			getUsageCounts: () => new Map(),
			getRankingAlgorithmNames: () => rankingAlgorithmNames,
		});

		expect(menu.open(editor as any, 'none')).toBe(true);

		const titles = Array.from(
			document.querySelectorAll('.snippet-completion-title')
		).map((el) => el.textContent);

		expect(titles).toEqual(['visible-snippet']);

		menu.close();
	});

	it('filters out matching hidden snippets even when query matches them', () => {
		snippets = [
			createSnippet('hidden-snippet', 'body', 'Hidden', undefined, true),
			createSnippet('visible-snippet', 'body', 'Visible'),
		];
		menu = new SnippetCompletionMenu(createApp(), {
			getSnippets: () => snippets,
			manager,
			logger: new PluginLogger(),
			getRankingAlgorithms: () => cloneDefaultRanking(),
			getUsageCounts: () => new Map(),
			getRankingAlgorithmNames: () => rankingAlgorithmNames,
		});

		expect(menu.open(editor as any, 'hidden-snippet')).toBe(true);

		const titles = Array.from(
			document.querySelectorAll('.snippet-completion-title')
		).map((el) => el.textContent);

		expect(titles).toEqual(['visible-snippet']);

		menu.close();
	});

	it('fails to open when every snippet is hidden', () => {
		snippets = [
			createSnippet('hidden-one', 'body', 'Hidden', undefined, true),
			createSnippet('hidden-two', 'body', 'Hidden two', undefined, true),
		];
		menu = new SnippetCompletionMenu(createApp(), {
			getSnippets: () => snippets,
			manager,
			logger: new PluginLogger(),
			getRankingAlgorithms: () => cloneDefaultRanking(),
			getUsageCounts: () => new Map(),
			getRankingAlgorithmNames: () => rankingAlgorithmNames,
		});

		expect(menu.open(editor as any, '')).toBe(false);
		expect(document.querySelector('.snippet-completion-menu')).toBeNull();
	});
});

describe('formatSnippetPreview', () => {
	it('inserts placeholder markers without duplicating escaped $$', () => {
		const snippet = {
			prefix: 'dd',
			body: '$$\n$0\n$$',
			processedText: '$\n\n$',
			tabStops: [{ index: 0, start: 2, end: 2 }],
		} as any;

		expect(formatSnippetPreview(snippet)).toBe('$\n$0\n$');
	});

	it('falls back to raw text when there are no stops', () => {
		const snippet = {
			prefix: 'plain',
			body: 'plain $1 text',
			processedText: 'plain  text',
			tabStops: [],
		} as any;

		expect(formatSnippetPreview(snippet)).toBe('plain  text');
	});
});
