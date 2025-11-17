import { VscodeSnippet, ParsedSnippet } from './types';
import { PluginLogger } from './logger';
import { processSnippetBody } from './snippetBody';

/**
 * Parser for VSCode-style snippet JSON
 */
export class SnippetParser {
	/**
	 * Parse JSON string containing snippets in VSCode format
	 * @param content Raw JSON content
	 * @returns Array of parsed snippets
	 */
	static parseJson(content: string, logger?: PluginLogger): ParsedSnippet[] {
		try {
			const data = JSON.parse(content);
			const snippets: ParsedSnippet[] = [];

			// Handle both object and array formats
			const snippetEntries = Array.isArray(data) ? data : Object.values(data);

			for (const snippet of snippetEntries) {
				if (this.isValidSnippet(snippet)) {
					const normalized = this.normalizeSnippet(snippet);
					const processed = processSnippetBody(normalized.body, logger);
					snippets.push({
						...normalized,
						processedText: processed.text,
						tabStops: processed.tabStops,
						variables: processed.variables,
					});
				}
			}

			return snippets;
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			console.error('Failed to parse snippet JSON:', error);
			throw new Error(`Failed to parse snippet JSON: ${message}`);
		}
	}

	/**
	 * Check if object is a valid VSCode snippet
	 */
	private static isValidSnippet(obj: any): obj is VscodeSnippet {
		return (
			obj &&
			typeof obj === 'object' &&
			typeof obj.prefix === 'string' &&
			obj.body &&
			(typeof obj.body === 'string' || Array.isArray(obj.body))
		);
	}

	/**
	 * Normalize snippet body to string format
	 */
	private static normalizeSnippet(snippet: VscodeSnippet): { prefix: string; body: string; description?: string } {
		const body = Array.isArray(snippet.body) ? snippet.body.join('\n') : snippet.body;

		return {
			prefix: snippet.prefix,
			body,
			description: snippet.description,
		};
	}

}
