import { PluginLogger } from './logger';
import { TabStopInfo, SnippetVariableInfo } from './types';

export const BUILTIN_VARIABLES = new Set([
	"TM_FILENAME",
	"TM_FILEPATH",
	"TM_FOLDER",
	"VAULT_NAME",
	"TM_CLIPBOARD",
	"CURRENT_YEAR",
	"CURRENT_MONTH",
	"CURRENT_DATE",
	"TIME_FORMATTED",
	"TM_SELECTED_TEXT",
	"CURRENT_HOUR",
	"CURRENT_MINUTE",
	"CURRENT_SECOND",
]);

export interface ProcessedSnippetBody {
	text: string;
	tabStops: TabStopInfo[];
	variables: SnippetVariableInfo[];
}

export const processSnippetBody = (body: string, logger?: PluginLogger): ProcessedSnippetBody => {
	logger?.debug("parser", `\n📝 Processing snippet body: "${body}"`);
	const parser = new SnippetBodyParser(body);
	const parsed = parser.parse();

	// 收集同一 index 的所有位置
	const stopsMap: Map<number, TabStopInfo[]> = new Map();
	for (const stop of parsed.placeholders) {
		const stopInfo: TabStopInfo = {
			index: stop.index,
			start: stop.start,
			end: stop.end,
			choices: stop.choices,
		};
		
		const existing = stopsMap.get(stop.index);
		if (existing) {
			existing.push(stopInfo);
		} else {
			stopsMap.set(stop.index, [stopInfo]);
		}
		
		if (stop.choices?.length) {
			logger?.debug(
				"parser",
				`    → Tab stop $${stop.index} choices: [${stop.choices.join(", ")}]`
			);
		}
	}

	// 处理隐式 $0
	if (!stopsMap.has(0)) {
		stopsMap.set(0, [{
			index: 0,
			start: parsed.text.length,
			end: parsed.text.length,
		}]);
		logger?.debug("parser", `    → Added implicit $0 at position ${parsed.text.length}`);
	}

	// 识别引用类型并生成 referenceGroup
	const tabStops: TabStopInfo[] = [];
	let referenceGroupCounter = 0;
	
	for (const [index, stops] of stopsMap.entries()) {
		if (stops.length > 1) {
			// 多个位置，标记为引用类型
			const referenceGroup = `ref_${referenceGroupCounter++}`;
			for (const stop of stops) {
				tabStops.push({
					...stop,
					type: 'reference',
					referenceGroup,
				});
			}
			logger?.debug("parser", `    → Tab stop $${index} has ${stops.length} positions (reference type, group: ${referenceGroup})`);
		} else {
			// 单个位置，标准类型
			tabStops.push({
				...stops[0],
				type: 'standard',
			});
		}
	}

	// 按 index 和 start 位置排序
	tabStops.sort((a, b) => {
		if (a.index !== b.index) return a.index - b.index;
		return a.start - b.start;
	});

	logger?.debug("parser", `\n✅ Final text: "${parsed.text}"`);
	logger?.debug("parser", `   Length: ${parsed.text.length}`);
	logger?.debug("parser", `📍 Tab stops:`);
	tabStops.forEach(stop => {
		const choiceInfo =
			stop.choices && stop.choices.length > 0
				? ` choices=[${stop.choices.join(', ')}]`
				: '';
		const typeInfo = stop.type === 'reference' ? ` type=reference group=${stop.referenceGroup}` : '';
		logger?.debug("parser", `   $${stop.index}: start=${stop.start}, end=${stop.end}${choiceInfo}${typeInfo}`);
	});

	const variables: SnippetVariableInfo[] = parsed.variables.map(variable => ({
		name: variable.name,
		start: variable.start,
		end: variable.end,
		defaultValue: variable.defaultValue,
	}));
	if (variables.length > 0) {
		logger?.debug("parser", `🔤 Variables:`);
		variables.forEach(variable => {
			const defaultInfo = variable.defaultValue ? ` default="${variable.defaultValue}"` : '';
			const knownInfo = BUILTIN_VARIABLES.has(variable.name) ? "" : " (unknown)";
			logger?.debug("parser", `   ${variable.name}: start=${variable.start}, end=${variable.end}${defaultInfo}${knownInfo}`);
		});
	}

	return {
		text: parsed.text,
		tabStops,
		variables,
	};
};

interface ParsedPlaceholderRange {
	index: number;
	start: number;
	end: number;
	choices?: string[];
}

interface ParsedVariableRange {
	name: string;
	start: number;
	end: number;
	defaultValue?: string;
}

interface SegmentParseResult {
	text: string;
	placeholders: ParsedPlaceholderRange[];
	variables: ParsedVariableRange[];
	terminated: boolean;
}

interface PlaceholderParseResult {
	index: number;
	text: string;
	inner: ParsedPlaceholderRange[];
	variables: ParsedVariableRange[];
	choices?: string[];
}

interface VariableParseResult {
	name: string;
	text: string;
	defaultValue?: string;
}

class SnippetBodyParser {
	private index = 0;

	constructor(private readonly source: string) {}

	parse(): { text: string; placeholders: ParsedPlaceholderRange[]; variables: ParsedVariableRange[] } {
		const segment = this.parseSegment();
		return {
			text: segment.text,
			placeholders: segment.placeholders,
			variables: segment.variables,
		};
	}

	private parseSegment(terminator?: string): SegmentParseResult {
		let text = '';
		const placeholders: ParsedPlaceholderRange[] = [];
		const variables: ParsedVariableRange[] = [];
		let terminated = !terminator;

		while (this.index < this.source.length) {
			const ch = this.source[this.index];

			if (terminator && ch === terminator) {
				this.index++;
				terminated = true;
				break;
			}

			if (ch === '$') {
				if (this.peek() === '$') {
					text += '$';
					this.index += 2;
					continue;
				}

			const placeholder = this.parsePlaceholder();
			if (placeholder) {
				const start = text.length;
				text += placeholder.text;
					const end = text.length;
					placeholders.push({ index: placeholder.index, start, end, choices: placeholder.choices });
				for (const inner of placeholder.inner) {
					placeholders.push({
						index: inner.index,
						start: start + inner.start,
						end: start + inner.end,
					});
				}
				for (const variable of placeholder.variables) {
					variables.push({
						name: variable.name,
						start: start + variable.start,
						end: start + variable.end,
						defaultValue: variable.defaultValue,
					});
				}
				continue;
			}

				const variable = this.parseVariable();
				if (variable) {
					const start = text.length;
					text += variable.text;
					const end = text.length;
					variables.push({
						name: variable.name,
						start,
						end,
						defaultValue: variable.defaultValue,
					});
					continue;
				}

				text += '$';
				this.index++;
				continue;
			}

			if (ch === '\\' && this.index + 1 < this.source.length) {
				const next = this.source[this.index + 1];
				if (next === '$' || next === '{' || next === '}') {
					text += next;
					this.index += 2;
					continue;
				}
			}

			text += ch;
			this.index++;
		}

		return { text, placeholders, variables, terminated };
	}

	private parsePlaceholder(): PlaceholderParseResult | null {
		const startIndex = this.index;
		this.index++; // skip '$'
		if (this.index >= this.source.length) {
			this.index = startIndex;
			return null;
		}

		const buildPlaceholder = (
			index: number,
			text: string,
			inner: ParsedPlaceholderRange[] = [],
			variables: ParsedVariableRange[] = [],
			choices?: string[]
		): PlaceholderParseResult => ({
			index,
			text,
			inner,
			variables,
			choices,
		});

		const ch = this.source[this.index];
		if (this.isDigit(ch)) {
			const digits = this.readNumber();
			if (digits.length === 0) {
				this.index = startIndex;
				return null;
			}
			return buildPlaceholder(parseInt(digits, 10), '');
		}

		if (ch !== '{') {
			this.index = startIndex;
			return null;
		}

		this.index++; // skip '{'
		const digits = this.readNumber();
		if (digits.length === 0 || Number.isNaN(Number(digits))) {
			this.index = startIndex;
			return null;
		}
		const placeholderIndex = parseInt(digits, 10);

		if (this.source[this.index] === '}') {
			this.index++;
			return buildPlaceholder(placeholderIndex, '');
		}

		if (this.source[this.index] === '|') {
			this.index++;
			const choices = this.readChoiceList();
			if (!choices) {
				this.index = startIndex;
				return null;
			}
			if (this.source[this.index] !== '}') {
				this.index = startIndex;
				return null;
			}
			this.index++;
			return buildPlaceholder(placeholderIndex, choices[0] ?? '', [], [], choices);
		}

		if (this.source[this.index] === ':') {
			this.index++;
			const segment = this.parseSegment('}');
			if (!segment.terminated) {
				this.index = startIndex;
				return null;
			}
			return buildPlaceholder(
				placeholderIndex,
				segment.text,
				segment.placeholders,
				segment.variables
			);
		}

		if (this.source[this.index] === '}') {
			this.index++;
			return buildPlaceholder(placeholderIndex, '');
		}

		this.index = startIndex;
		return null;
	}

	private parseVariable(): VariableParseResult | null {
		const startIndex = this.index;
		this.index++; // skip '$'
		if (this.index >= this.source.length) {
			this.index = startIndex;
			return null;
		}

		let ch = this.source[this.index];
		if (ch === '{') {
			this.index++;
			const name = this.readIdentifier();
			if (!name) {
				this.index = startIndex;
				return null;
			}
			if (this.source[this.index] === '}') {
				this.index++;
				return { name, text: '' };
			}
			if (this.source[this.index] === ':') {
				this.index++;
				const defaultText = this.readVariableDefault();
				if (defaultText === null) {
					this.index = startIndex;
					return null;
				}
				if (this.source[this.index] !== '}') {
					this.index = startIndex;
					return null;
				}
				this.index++;
				return { name, text: defaultText, defaultValue: defaultText };
			}
			this.index = startIndex;
			return null;
		}

		if (!this.isVarChar(ch)) {
			this.index = startIndex;
			return null;
		}

		const name = this.readIdentifier();
		if (!name) {
			this.index = startIndex;
			return null;
		}
		return { name, text: '' };
	}

	private readNumber(): string {
		const start = this.index;
		while (this.index < this.source.length && this.isDigit(this.source[this.index])) {
			this.index++;
		}
		return this.source.slice(start, this.index);
	}

	private peek(): string | undefined {
		return this.index + 1 < this.source.length ? this.source[this.index + 1] : undefined;
	}

	private isDigit(ch: string): boolean {
		return ch >= '0' && ch <= '9';
	}

	private readIdentifier(): string {
		const start = this.index;
		while (this.index < this.source.length && this.isVarChar(this.source[this.index])) {
			this.index++;
		}
		return this.source.slice(start, this.index);
	}

	private isVarChar(ch: string): boolean {
		return (
			(ch >= 'A' && ch <= 'Z') ||
			(ch >= 'a' && ch <= 'z') ||
			(ch >= '0' && ch <= '9') ||
			ch === '_'
		);
	}

	private readVariableDefault(): string | null {
		let result = '';
		while (this.index < this.source.length) {
			const ch = this.source[this.index];
			if (ch === '\\' && this.index + 1 < this.source.length) {
				result += this.source[this.index + 1];
				this.index += 2;
				continue;
			}
			if (ch === '}') {
				return result;
			}
			result += ch;
			this.index++;
		}
		return null;
	}

	private readChoiceList(): string[] | null {
		const choices: string[] = [];
		let current = '';
		while (this.index < this.source.length) {
			const ch = this.source[this.index];
			if (ch === '\\' && this.index + 1 < this.source.length) {
				current += this.source[this.index + 1];
				this.index += 2;
				continue;
			}
			if (ch === ',') {
				choices.push(current);
				current = '';
				this.index++;
				continue;
			}
			if (ch === '|') {
				this.index++;
				choices.push(current);
				return choices;
			}
			current += ch;
			this.index++;
		}
		return null;
	}
}
