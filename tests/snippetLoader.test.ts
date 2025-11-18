import { App } from 'obsidian';
import { SnippetLoader } from '../src/snippetLoader';
import { PluginLogger } from '../src/logger';

const createVault = () => ({
	getAbstractFileByPath: jest.fn(),
	read: jest.fn(),
	getFiles: jest.fn().mockReturnValue([]),
});

const createApp = () => ({
	vault: createVault(),
}) as unknown as App;

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
