import type { DebugCategory } from "./logger";

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
	type?: 'standard' | 'reference' | 'function';  // stop 类型
	referenceGroup?: string;  // 引用组标识(相同 index 的 stops 共享)
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

export interface SnippetWidgetConfig {
	enabled: boolean;
	placeholderColor?: string;
	placeholderActiveColor?: string;
	ghostTextColor?: string;
	choiceActiveColor?: string;
	choiceInactiveColor?: string;
}

export interface PluginSettings {
	snippetFiles: string[];
	showVirtualText: boolean;
	virtualTextColor: string;
	enableDebugLogs: boolean;
	triggerKey: string;
	menuKeymap: SnippetMenuKeymap;
	debugCategories: DebugCategory[];
	rankingAlgorithms: RankingAlgorithmSetting[];
	snippetUsage: Record<string, number>;
	choiceHighlightColor: string;
	choiceInactiveColor: string;
	placeholderActiveColor: string;
	ghostTextColor: string;
	virtualTextPresets: VirtualTextColorPreset[];
	selectedVirtualTextPresetName: string;
	referenceSnippetEnabled: boolean;  // 是否启用引用 snippet
	referenceSyncMode: 'realtime' | 'on-jump';  // 同步模式
}

/**
 * Raw plugin settings as loaded from storage, may include legacy properties
 */
export interface RawPluginSettings extends Partial<PluginSettings> {
	/**
	 * Legacy property: single snippet file path (migrated to snippetFiles array)
	 * @deprecated Use snippetFiles instead
	 */
	snippetsFilePath?: string;
}

export interface VirtualTextColorPreset {
	name?: string;
	placeholderColor: string;
	placeholderActiveColor: string;
	ghostTextColor: string;
	choiceActiveColor: string;
	choiceInactiveColor: string;
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
