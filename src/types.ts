/**
 * VSCode-style snippet definition
 * Example:
 * {
 *   "prefix": "log",
 *   "body": "console.log($1);",
 *   "description": "Print to console"
 * }
 */
export interface VscodeSnippet {
	prefix: string;
	body: string | string[];
	description?: string;
}

/**
 * Internal snippet representation with parsed body
 */
export interface ParsedSnippet extends VscodeSnippet {
	body: string; // body is always a string in parsed format
	processedText: string;
	tabStops: TabStopInfo[];
}

/**
 * Plugin settings
 */
export interface TextSnippetsSettings {
	snippetsFilePath: string;
	snippets: ParsedSnippet[];
	useTab: boolean;
	useSpace: boolean;
	isWYSIWYG: boolean;
}

/**
 * Trie node for prefix matching
 */
export interface TrieNode {
	children: Map<string, TrieNode>;
	snippet?: ParsedSnippet; // Leaf node with snippet
}

/**
 * Prefix range info
 */
export interface PrefixInfo {
	minLength: number;
	maxLength: number;
}

/**
 * Tab stop information with start and end positions
 */
export interface TabStopInfo {
	index: number;      // $1, $2, $0
	start: number;      // Start position in line
	end: number;        // End position in line (for range)
}

/**
 * Delta tracker for tracking text changes
 */
export interface DeltaChange {
	tabStopIndex: number;  // Which tab stop was edited (e.g., 1 for $1)
	deltaLength: number;   // Change in text length (positive or negative)
}

export interface SnippetMenuKeymap {
	next: string;
	prev: string;
	accept: string;
	toggle: string;
}
