import { App, Notice, TFile } from "obsidian";
import { ParsedSnippet } from "./types";
import { SnippetParser } from "./snippetParser";
import { PluginLogger } from "./logger";
import { getMonotonicTime } from "./telemetry";
import { getErrorMessage } from "./utils/errorUtils";

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
		const loadStart = getMonotonicTime();

		try {
			this.logger.debug("loader", `📂 Loading snippets from: ${filePath}`);

			if (!filePath) {
				throw new Error('Snippets file path is not set');
			}

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
			this.logger.debug("loader", `✅ Read file: ${content.length} characters`);

			let snippets: ParsedSnippet[];
			try {
				snippets = SnippetParser.parseJson(content, this.logger);
			} catch (error) {
				const message = getErrorMessage(error);
				console.error(message);
				new Notice(`Error: ${message}`, 5000);
				return [];
			}
			const duration = getMonotonicTime() - loadStart;
			this.logSnippetsLoaded(filePath, snippets, duration);

			return snippets.map((snippet) => ({
				...snippet,
				source: filePath,
			}));
		} catch (error) {
			const message = getErrorMessage(error);
			console.error('Failed to load snippets:', error);
			new Notice(`Error: Failed to load snippets. ${message}`, 5000);
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
		this.logger.debug("loader", 'Available files in vault:');
		const files = this.getTextFiles();
		files.slice(0, 10).forEach(f => this.logger.debug("loader", `  - ${f.path}`));
	}

	/**
	 * Log loaded snippets
	 */
	private logSnippetsLoaded(
		filePath: string,
		snippets: ParsedSnippet[],
		durationMs: number
	): void {
		this.logger.debug("loader", '=== ObVsnip ===');
		const hiddenCount = snippets.filter((snippet) => snippet.hide).length;
		this.logger.debug(
			"loader",
			`✅ Loaded ${snippets.length} snippets from: ${filePath} (${hiddenCount} hidden) in ${durationMs.toFixed(
				2
			)}ms`
		);
		this.logger.debug("loader", 'Snippets:');
		snippets.forEach((snippet, index) => {
			const preview = snippet.body.substring(0, 50).replace(/\n/g, '\\n');
			this.logger.debug("loader", `  [${index + 1}] "${snippet.prefix}" → "${preview}${snippet.body.length > 50 ? '...' : ''}"`);
		});
		this.logger.debug("loader", '============================');
	}
}
