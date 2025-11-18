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
	hide?: boolean;
	priority?: number;
}

/**
 * Internal snippet representation with parsed body
 */
export interface ParsedSnippet extends VscodeSnippet {
	body: string; // body is always a string in parsed format
	processedText: string;
	tabStops: TabStopInfo[];
	variables?: SnippetVariableInfo[];
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
	choices?: string[]; // Optional choice list for ${1|a,b|}
}

export interface SnippetVariableInfo {
	name: string;       // e.g., TM_FILENAME
	start: number;      // Start position in processed text
	end: number;        // End position after default text insertion
	defaultValue?: string;
}

export interface SnippetMenuKeymap {
	next: string;
	prev: string;
	accept: string;
	toggle: string;
}

export interface WidgetHighlightConfig {
	choiceColor?: string;
}

export type RankingAlgorithmId =
	| "fuzzy-match"
	| "prefix-length"
	| "alphabetical"
	| "usage-frequency"
	| "original-order";

export interface RankingAlgorithmSetting {
	id: RankingAlgorithmId;
	enabled: boolean;
}
