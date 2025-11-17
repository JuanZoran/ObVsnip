import { ParsedSnippet, TrieNode, PrefixInfo, TabStopInfo } from "./types";
import { PluginLogger } from "./logger";

/**
 * Snippet expansion engine with Trie-based prefix matching
 */
export class SnippetEngine {
	private snippets: ParsedSnippet[] = [];
	private trie: TrieNode = { children: new Map() };
	private prefixInfo: PrefixInfo = { minLength: 0, maxLength: 0 };
	private logger: PluginLogger | null = null;

	constructor(snippets: ParsedSnippet[] = []) {
		this.setSnippets(snippets);
	}

	/**
	 * Set snippets and rebuild Trie
	 */
	setSnippets(snippets: ParsedSnippet[]): void {
		this.snippets = snippets;
		this.buildTrie();
		this.calculatePrefixRange();
	}

	setLogger(logger: PluginLogger): void {
		this.logger = logger;
	}

	private logDebug(...data: unknown[]): void {
		this.logger?.debug(...data);
	}

	/**
	 * Get all snippets
	 */
	getSnippets(): ParsedSnippet[] {
		return this.snippets;
	}

	/**
	 * Build Trie from snippets
	 */
	private buildTrie(): void {
		this.trie = { children: new Map() };

		for (const snippet of this.snippets) {
			let node = this.trie;
			for (const char of snippet.prefix) {
				if (!node.children.has(char)) {
					node.children.set(char, { children: new Map() });
				}
				node = node.children.get(char)!;
			}
			node.snippet = snippet;
		}
	}

	/**
	 * Calculate min and max prefix lengths
	 */
	private calculatePrefixRange(): void {
		if (this.snippets.length === 0) {
			this.prefixInfo = { minLength: 0, maxLength: 0 };
			return;
		}

		const lengths = this.snippets.map((s) => s.prefix.length);
		this.prefixInfo = {
			minLength: Math.min(...lengths),
			maxLength: Math.max(...lengths),
		};
	}

	/**
	 * Match snippet at cursor position using Trie + character extraction
	 * Algorithm:
	 * 1. Extract up to maxLength characters before cursor
	 * 2. Try substrings from minLength onwards
	 * 3. Search in Trie from longest to shortest
	 */
	matchSnippetAtCursor(
		line: string,
		cursorPos: number
	): ParsedSnippet | undefined {
		if (this.prefixInfo.maxLength === 0) {
			return undefined;
		}

		// Extract characters before cursor
		const startPos = Math.max(0, cursorPos - this.prefixInfo.maxLength);
		const beforeCursor = line.substring(startPos, cursorPos);

		// Try matching from minLength to maxLength, longest first
		for (
			let len = Math.min(beforeCursor.length, this.prefixInfo.maxLength);
			len >= this.prefixInfo.minLength;
			len--
		) {
			const prefix = beforeCursor.substring(beforeCursor.length - len);
			const snippet = this.findByPrefix(prefix);
			if (snippet) {
				return snippet;
			}
		}

		return undefined;
	}

	/**
	 * Find snippet in Trie by exact prefix match
	 */
	private findByPrefix(prefix: string): ParsedSnippet | undefined {
		let node = this.trie;
		for (const char of prefix) {
			const next = node.children.get(char);
			if (!next) return undefined;
			node = next;
		}
		return node.snippet;
	}

	/**
	 * Extract the prefix string from line that matched the snippet
	 * Returns { prefix, start, end } where start/end are character positions
	 */
	extractMatchedPrefix(
		line: string,
		cursorPos: number,
		snippetPrefix: string
	): { prefix: string; start: number; end: number } {
		const start = Math.max(0, cursorPos - this.prefixInfo.maxLength);
		const beforeCursor = line.substring(start, cursorPos);

		// Find where the snippet prefix actually starts in the line
		const prefixStartInExtract = beforeCursor.length - snippetPrefix.length;
		const actualStart = start + prefixStartInExtract;

		return {
			prefix: snippetPrefix,
			start: actualStart,
			end: cursorPos,
		};
	}

	/**
	 * Process snippet body to extract tab stops
	 * Returns processed text and tab stop positions with start/end
	 */
	processSnippetBody(body: string): {
		text: string;
		tabStops: TabStopInfo[];
	} {
		const stops: Map<number, TabStopInfo> = new Map();
		let result = "";
		let charIndex = 0;

		this.logDebug(`\n📝 Processing snippet body: "${body}"`);

		// Match $1 and ${1:text} style placeholders
		const regex = /\$\{(\d+)(?::([^}]*))?\}|\$(\d+)/g;
		let lastIndex = 0;
		let match;

		while ((match = regex.exec(body)) !== null) {
			// Add text before this match
			const textBefore = body.substring(lastIndex, match.index);
			result += textBefore;
			charIndex += textBefore.length;

			const tabStopNum = match[1] ?? match[3];
			const placeholderText = match[2];

			if (tabStopNum === undefined) continue;

			const stopIndex = parseInt(tabStopNum);

			this.logDebug(
				`  Found placeholder $${stopIndex} at body index ${
					match.index
				}, result charIndex ${charIndex}, placeholder="${
					placeholderText ?? ""
				}"`
			);

			const startPos = charIndex;

			// Insert placeholder text if provided (e.g., ${1:text})
			if (placeholderText !== undefined) {
				result += placeholderText;
				charIndex += placeholderText.length;
			}

			const endPos = charIndex;

			if (stopIndex >= 0) {
				stops.set(stopIndex, {
					index: stopIndex,
					start: startPos,
					end: endPos,
				});
				this.logDebug(
					`    → Recorded: $${stopIndex} at range ${startPos}-${endPos}`
				);
			} else {
				this.logDebug(
					`    → Ignored invalid placeholder index ${tabStopNum}`
				);
			}

			lastIndex = regex.lastIndex;
		}

		// Add remaining text
		const remaining = body.substring(lastIndex);
		result += remaining;

		// VSCode automatically treats the end of the snippet as $0 (exit point)
		// when an explicit $0 placeholder isn't provided. Mirror that behaviour
		// so navigation always has a final stop to land on.
		if (!stops.has(0)) {
			const exitPosition = result.length;
			stops.set(0, {
				index: 0,
				start: exitPosition,
				end: exitPosition,
			});
			this.logDebug(
				`    → Added implicit $0 at position ${exitPosition}`
			);
		}

		this.logDebug(`\n✅ Final text: "${result}"`);
		this.logDebug(`   Length: ${result.length}`);

		// Convert to sorted array for navigation
		const sortedStops = Array.from(stops.values()).sort(
			(a, b) => a.index - b.index
		);
		this.logDebug(`📍 Tab stops:`);
		sortedStops.forEach((stop) => {
			this.logDebug(
				`   $${stop.index}: start=${stop.start}, end=${stop.end}`
			);
		});

		return {
			text: result,
			tabStops: sortedStops,
		};
	}
}
