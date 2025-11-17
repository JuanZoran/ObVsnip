import { App, Notice, TFile } from 'obsidian';
import { ParsedSnippet } from './types';
import { SnippetParser } from './snippetParser';
import { PluginLogger } from './logger';

/**
 * Handles loading and managing snippet files
 */
export class SnippetLoader {
	constructor(private app: App, private logger: PluginLogger = new PluginLogger()) {}

	/**
	 * Load snippets from a vault file
	 * @param filePath Path relative to vault root
	 * @returns Array of parsed snippets
	 */
	async loadFromFile(filePath: string): Promise<ParsedSnippet[]> {
		if (!filePath) {
			console.warn('Snippets file path is not set');
			return [];
		}

		try {
			this.logger.debug(`📂 Loading snippets from: ${filePath}`);

			const file = this.app.vault.getAbstractFileByPath(filePath);
			if (!file) {
				console.error(`❌ File not found: ${filePath}`);
				this.logAvailableFiles();
				return [];
			}

			if (!file.hasOwnProperty('stat')) {
				console.error(`❌ Path is not a file: ${filePath}`);
				return [];
			}

			const content = await this.app.vault.read(file as TFile);
			this.logger.debug(`✅ Read file: ${content.length} characters`);

			const snippets = SnippetParser.parseJson(content, this.logger);
			this.logSnippetsLoaded(filePath, snippets);

			return snippets;
		} catch (error) {
			console.error('Failed to load snippets:', error);
			new Notice('Error: Failed to load snippets. Check file path in settings.', 5000);
			return [];
		}
	}

	/**
	 * Get list of all JSON files in vault for snippet selection
	 */
	getTextFiles(): TFile[] {
		return this.app.vault
			.getFiles()
			.filter(f => f.extension === 'json')
			.sort((a, b) => a.path.localeCompare(b.path));
	}

	/**
	 * Log available files for debugging
	 */
	private logAvailableFiles(): void {
		this.logger.debug('Available files in vault:');
		const files = this.getTextFiles();
		files.slice(0, 10).forEach(f => this.logger.debug(`  - ${f.path}`));
	}

	/**
	 * Log loaded snippets
	 */
	private logSnippetsLoaded(filePath: string, snippets: ParsedSnippet[]): void {
		this.logger.debug('=== Text Snippets Plugin ===');
		this.logger.debug(`✅ Loaded ${snippets.length} snippets from: ${filePath}`);
		this.logger.debug('Snippets:');
		snippets.forEach((snippet, index) => {
			const preview = snippet.body.substring(0, 50).replace(/\n/g, '\\n');
			this.logger.debug(`  [${index + 1}] "${snippet.prefix}" → "${preview}${snippet.body.length > 50 ? '...' : ''}"`);
		});
		this.logger.debug('============================');
	}
}
