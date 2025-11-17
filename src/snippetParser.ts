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
					});
				}
			}

			return snippets;
		} catch (error) {
			console.error('Failed to parse snippet JSON:', error);
			return [];
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

	/**
	 * Replace snippet variables with appropriate values
	 * Supports: $1, $2, ... for tab stops and ${1:default} for defaults
	 * @param body Snippet body with variables
	 * @param replacements Map of variable values
	 * @returns Processed snippet text
	 */
	static processVariables(body: string, replacements: Map<number, string> = new Map()): string {
		let result = body;

		// Replace tab stops with content
		result = result.replace(/\$\{(\d+):[^}]*\}/g, (match, num) => {
			return replacements.get(parseInt(num)) || '';
		});

		result = result.replace(/\$(\d+)/g, (match, num) => {
			return replacements.get(parseInt(num)) || '';
		});

		return result;
	}
}
