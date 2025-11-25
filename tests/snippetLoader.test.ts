import { App, TFile, Notice } from 'obsidian';
import { SnippetLoader } from '../src/snippetLoader';
import { PluginLogger } from '../src/logger';

jest.mock('obsidian', () => {
	const obsidian = jest.requireActual('./mocks/obsidian');
	return obsidian;
});

const createVault = () => ({
	getAbstractFileByPath: jest.fn(),
	read: jest.fn(),
	getFiles: jest.fn().mockReturnValue([]),
});

const createApp = () => ({
	vault: createVault(),
}) as unknown as App;

const createTFile = (path: string, extension: string = 'json'): TFile => {
	const file = new TFile();
	file.path = path;
	file.extension = extension;
	(file as any).stat = {}; // Add stat property to indicate it's a file
	return file;
};

describe('SnippetLoader error handling', () => {
	beforeEach(() => {
		jest.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		(console.error as jest.Mock).mockRestore();
	});

	it('returns empty array when file missing', async () => {
		const app = createApp();
		app.vault.getAbstractFileByPath.mockReturnValue(null);
		const loader = new SnippetLoader(app, new PluginLogger());
		const result = await loader.loadFromFile('missing.json');
		expect(result).toEqual([]);
	});

	it('returns empty array when path is not a file', async () => {
		const app = createApp();
		app.vault.getAbstractFileByPath.mockReturnValue({});
		const loader = new SnippetLoader(app, new PluginLogger());
		const result = await loader.loadFromFile('folder');
		expect(result).toEqual([]);
	});

	it('handles vault.read errors gracefully', async () => {
		const app = createApp();
		app.vault.getAbstractFileByPath.mockReturnValue({ stat: {} });
		app.vault.read.mockRejectedValue(new Error('read error'));
		const loader = new SnippetLoader(app, new PluginLogger());
		const result = await loader.loadFromFile('file.json');
		expect(result).toEqual([]);
	});
});

describe('SnippetLoader success paths', () => {
	beforeEach(() => {
		jest.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		(console.error as jest.Mock).mockRestore();
	});

	it('loads snippets successfully from valid JSON file (object format)', async () => {
		const app = createApp();
		const file = createTFile('snippets.json');
		app.vault.getAbstractFileByPath.mockReturnValue(file);
		app.vault.read.mockResolvedValue(JSON.stringify({
			'Test Snippet': {
				prefix: 'test',
				body: 'Hello ${1:World}',
				description: 'Test description',
			},
		}));

		const loader = new SnippetLoader(app, new PluginLogger());
		const result = await loader.loadFromFile('snippets.json');

		expect(result).toHaveLength(1);
		expect(result[0].prefix).toBe('test');
		expect(result[0].body).toBe('Hello ${1:World}');
		expect(result[0].description).toBe('Test description');
		expect(result[0].processedText).toBeDefined();
		expect(result[0].tabStops).toBeDefined();
	});

	it('loads snippets successfully from valid JSON file (array format)', async () => {
		const app = createApp();
		const file = createTFile('snippets.json');
		app.vault.getAbstractFileByPath.mockReturnValue(file);
		app.vault.read.mockResolvedValue(JSON.stringify([
			{
				prefix: 'test1',
				body: 'Snippet 1',
				description: 'First snippet',
			},
			{
				prefix: 'test2',
				body: 'Snippet 2',
				description: 'Second snippet',
			},
		]));

		const loader = new SnippetLoader(app, new PluginLogger());
		const result = await loader.loadFromFile('snippets.json');

		expect(result).toHaveLength(2);
		expect(result[0].prefix).toBe('test1');
		expect(result[1].prefix).toBe('test2');
	});

	it('handles empty JSON file', async () => {
		const app = createApp();
		const file = createTFile('empty.json');
		app.vault.getAbstractFileByPath.mockReturnValue(file);
		app.vault.read.mockResolvedValue('{}');

		const loader = new SnippetLoader(app, new PluginLogger());
		const result = await loader.loadFromFile('empty.json');

		expect(result).toEqual([]);
	});

	it('handles JSON file with invalid snippets', async () => {
		const app = createApp();
		const file = createTFile('invalid.json');
		app.vault.getAbstractFileByPath.mockReturnValue(file);
		app.vault.read.mockResolvedValue(JSON.stringify({
			'Valid Snippet': {
				prefix: 'valid',
				body: 'Valid content',
			},
			'Invalid Snippet': {
				// Missing required fields
				body: 'Missing prefix',
			},
		}));

		const loader = new SnippetLoader(app, new PluginLogger());
		const result = await loader.loadFromFile('invalid.json');

		expect(result).toHaveLength(1);
		expect(result[0].prefix).toBe('valid');
	});

	it('handles JSON parse errors gracefully', async () => {
		const app = createApp();
		const file = createTFile('malformed.json');
		app.vault.getAbstractFileByPath.mockReturnValue(file);
		app.vault.read.mockResolvedValue('{ invalid json }');

		const loader = new SnippetLoader(app, new PluginLogger());
		const result = await loader.loadFromFile('malformed.json');

		expect(result).toEqual([]);
	});
});

describe('SnippetLoader file list queries', () => {
	it('returns all JSON files sorted by path', () => {
		const app = createApp();
		const files = [
			createTFile('zebra.json'),
			createTFile('alpha.json'),
			createTFile('beta.json'),
			createTFile('other.txt', 'txt'),
			createTFile('gamma.json'),
		];
		app.vault.getFiles.mockReturnValue(files);

		const loader = new SnippetLoader(app, new PluginLogger());
		const result = loader.getTextFiles();

		expect(result).toHaveLength(4);
		expect(result[0].path).toBe('alpha.json');
		expect(result[1].path).toBe('beta.json');
		expect(result[2].path).toBe('gamma.json');
		expect(result[3].path).toBe('zebra.json');
	});

	it('filters out non-JSON files', () => {
		const app = createApp();
		const files = [
			createTFile('snippets.json'),
			createTFile('readme.md', 'md'),
			createTFile('config.txt', 'txt'),
			createTFile('data.json'),
		];
		app.vault.getFiles.mockReturnValue(files);

		const loader = new SnippetLoader(app, new PluginLogger());
		const result = loader.getTextFiles();

		expect(result).toHaveLength(2);
		expect(result[0].path).toBe('data.json');
		expect(result[1].path).toBe('snippets.json');
	});

	it('returns empty array when no JSON files exist', () => {
		const app = createApp();
		const files = [
			createTFile('readme.md', 'md'),
			createTFile('config.txt', 'txt'),
		];
		app.vault.getFiles.mockReturnValue(files);

		const loader = new SnippetLoader(app, new PluginLogger());
		const result = loader.getTextFiles();

		expect(result).toEqual([]);
	});

	it('handles empty vault', () => {
		const app = createApp();
		app.vault.getFiles.mockReturnValue([]);

		const loader = new SnippetLoader(app, new PluginLogger());
		const result = loader.getTextFiles();

		expect(result).toEqual([]);
	});

	it('sorts files case-insensitively', () => {
		const app = createApp();
		const files = [
			createTFile('Zebra.json'),
			createTFile('alpha.json'),
			createTFile('Beta.json'),
		];
		app.vault.getFiles.mockReturnValue(files);

		const loader = new SnippetLoader(app, new PluginLogger());
		const result = loader.getTextFiles();

		expect(result[0].path).toBe('alpha.json');
		expect(result[1].path).toBe('Beta.json');
		expect(result[2].path).toBe('Zebra.json');
	});
});
