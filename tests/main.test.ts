import TextSnippetsPlugin from '../main';
import { App } from 'obsidian';
import type { RawPluginSettings } from '../src/types';

jest.mock('obsidian', () => {
	const obsidian = jest.requireActual('./mocks/obsidian');
	return obsidian;
});

// Mock Obsidian App
const createMockApp = (): App => {
	return {
		workspace: {
			layoutReady: true,
			getActiveViewOfType: () => null,
			getLeavesOfType: () => [],
			on: jest.fn(),
			onLayoutReady: jest.fn((callback) => callback()),
		},
		vault: {
			getConfig: jest.fn(),
		},
	} as any;
};

describe('Settings Migration', () => {
	let plugin: TextSnippetsPlugin;
	let mockApp: App;

	beforeEach(() => {
		mockApp = createMockApp();
		plugin = new TextSnippetsPlugin(mockApp, null as any);
		// Mock loadData to return test data
		plugin.loadData = jest.fn();
		// Mock saveData
		plugin.saveData = jest.fn();
	});

	describe('Legacy snippetsFilePath migration', () => {
		it('should migrate legacy snippetsFilePath to snippetFiles array', async () => {
			const legacySettings: RawPluginSettings = {
				snippetsFilePath: '/path/to/snippets.json',
			};

			(plugin.loadData as jest.Mock).mockResolvedValue(legacySettings);
			await plugin.loadSettings();

			expect(plugin.settings.snippetFiles).toEqual(['/path/to/snippets.json']);
			expect((plugin.settings as any).snippetsFilePath).toBeUndefined();
		});

		it('should not migrate if snippetFiles already exists', async () => {
			const settings: RawPluginSettings = {
				snippetsFilePath: '/legacy/path.json',
				snippetFiles: ['/new/path.json'],
			};

			(plugin.loadData as jest.Mock).mockResolvedValue(settings);
			await plugin.loadSettings();

			expect(plugin.settings.snippetFiles).toEqual(['/new/path.json']);
			expect((plugin.settings as any).snippetsFilePath).toBeUndefined();
		});

		it('should handle empty legacy snippetsFilePath', async () => {
			const settings: RawPluginSettings = {
				snippetsFilePath: '',
			};

			(plugin.loadData as jest.Mock).mockResolvedValue(settings);
			await plugin.loadSettings();

			expect(plugin.settings.snippetFiles).toEqual([]);
			expect((plugin.settings as any).snippetsFilePath).toBeUndefined();
		});

		it('should handle null legacy snippetsFilePath', async () => {
			const settings: RawPluginSettings = {
				snippetsFilePath: null as any,
			};

			(plugin.loadData as jest.Mock).mockResolvedValue(settings);
			await plugin.loadSettings();

			expect(plugin.settings.snippetFiles).toEqual([]);
		});

		it('should handle non-string legacy snippetsFilePath', async () => {
			const settings: RawPluginSettings = {
				snippetsFilePath: 123 as any,
			};

			(plugin.loadData as jest.Mock).mockResolvedValue(settings);
			await plugin.loadSettings();

			// Should not migrate invalid types
			expect(Array.isArray(plugin.settings.snippetFiles)).toBe(true);
		});

		it('should handle undefined raw settings', async () => {
			(plugin.loadData as jest.Mock).mockResolvedValue(undefined);
			await plugin.loadSettings();

			expect(plugin.settings.snippetFiles).toEqual([]);
			expect((plugin.settings as any).snippetsFilePath).toBeUndefined();
		});

		it('should handle empty raw settings object', async () => {
			(plugin.loadData as jest.Mock).mockResolvedValue({});
			await plugin.loadSettings();

			expect(plugin.settings.snippetFiles).toEqual([]);
			expect((plugin.settings as any).snippetsFilePath).toBeUndefined();
		});

		it('should preserve other settings during migration', async () => {
			const settings: RawPluginSettings = {
				snippetsFilePath: '/legacy/path.json',
				triggerKey: 'Space',
				showVirtualText: false,
			};

			(plugin.loadData as jest.Mock).mockResolvedValue(settings);
			await plugin.loadSettings();

			expect(plugin.settings.snippetFiles).toEqual(['/legacy/path.json']);
			expect(plugin.settings.triggerKey).toBe('Space');
			expect(plugin.settings.showVirtualText).toBe(false);
		});
	});
});

