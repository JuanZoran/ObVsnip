import { ParsedSnippet, TrieNode, PrefixInfo } from "./types";

/**
 * Snippet expansion engine with Trie-based prefix matching
 */
export class SnippetEngine {
	private snippets: ParsedSnippet[] = [];
	private trie: TrieNode = { children: new Map() };
	private prefixInfo: PrefixInfo = { minLength: 0, maxLength: 0 };
	private snippetsHash: string = '';

	constructor(snippets: ParsedSnippet[] = []) {
		this.setSnippets(snippets);
	}

	/**
	 * Set snippets and rebuild Trie only if snippets have changed
	 */
	setSnippets(snippets: ParsedSnippet[]): void {
		const newHash = this.computeSnippetsHash(snippets);
		if (newHash === this.snippetsHash && snippets === this.snippets) {
			// Same reference and same content, skip rebuild
			return;
		}

		this.snippets = snippets;
		this.snippetsHash = newHash;
		this.buildTrie();
		this.calculatePrefixRange();
	}

	/**
	 * Compute a simple hash of snippets for change detection
	 */
	private computeSnippetsHash(snippets: ParsedSnippet[]): string {
		if (snippets.length === 0) {
			return '';
		}
		
		// Create a hash based on snippet count and prefixes
		// This is a lightweight check - full equality would be more expensive
		const prefixList = snippets
			.map(s => s.prefix)
			.sort()
			.join('|');
		
		return `${snippets.length}:${prefixList}`;
	}

	getPrefixInfo(): PrefixInfo {
		return { ...this.prefixInfo };
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
				let nextNode = node.children.get(char);
				if (!nextNode) {
					nextNode = { children: new Map() };
					node.children.set(char, nextNode);
				}
				node = nextNode;
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

	matchSnippetInContext(beforeCursor: string): ParsedSnippet | undefined {
		if (this.prefixInfo.maxLength === 0) {
			return undefined;
		}

		const relevantLength = Math.min(
			beforeCursor.length,
			this.prefixInfo.maxLength
		);
		if (relevantLength === 0) {
			return undefined;
		}

		const relevantText = beforeCursor.slice(-relevantLength);

		// Try matching from shortest substring nearest the cursor, expanding outwards
		for (let len = 1; len <= relevantText.length; len++) {
			const prefixStart = relevantText.length - len;
			const prefix = relevantText.substring(prefixStart);
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

}
