import { PluginLogger } from './logger';
import { TabStopInfo, SnippetVariableInfo } from './types';

const BUILTIN_VARIABLES = new Set([
	"TM_FILENAME",
	"TM_FILEPATH",
	"CURRENT_YEAR",
	"CURRENT_MONTH",
	"CURRENT_DATE",
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

	const stopsMap: Map<number, TabStopInfo> = new Map();
	for (const stop of parsed.placeholders) {
		stopsMap.set(stop.index, stop);
		if (stop.choices && stop.choices.length > 0) {
			logger?.debug(
				"parser",
				`    → Tab stop $${stop.index} choices: [${stop.choices.join(", ")}]`
			);
		}
	}

	if (!stopsMap.has(0)) {
		stopsMap.set(0, {
			index: 0,
			start: parsed.text.length,
			end: parsed.text.length,
		});
		logger?.debug("parser", `    → Added implicit $0 at position ${parsed.text.length}`);
	}

	logger?.debug("parser", `\n✅ Final text: "${parsed.text}"`);
	logger?.debug("parser", `   Length: ${parsed.text.length}`);

	const tabStops = Array.from(stopsMap.values()).sort((a, b) => a.index - b.index);
	logger?.debug("parser", `📍 Tab stops:`);
	tabStops.forEach(stop => {
		const choiceInfo =
			stop.choices && stop.choices.length > 0
				? ` choices=[${stop.choices.join(', ')}]`
				: '';
		logger?.debug("parser", `   $${stop.index}: start=${stop.start}, end=${stop.end}${choiceInfo}`);
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
			logger?.debug("parser", `   ${variable.name}: start=${variable.start}, end=${variable.end}${defaultInfo}`);
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

		const ch = this.source[this.index];
		if (this.isDigit(ch)) {
			const digits = this.readNumber();
			if (digits.length === 0) {
				this.index = startIndex;
				return null;
			}
			return {
				index: parseInt(digits, 10),
				text: '',
				inner: [],
			};
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
			return { index: placeholderIndex, text: '', inner: [] };
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
			return {
				index: placeholderIndex,
				text: choices[0] ?? '',
				inner: [],
				choices,
			};
		}

		if (this.source[this.index] === ':') {
			this.index++;
			const segment = this.parseSegment('}');
			if (!segment.terminated) {
				this.index = startIndex;
				return null;
			}
			return {
				index: placeholderIndex,
				text: segment.text,
				inner: segment.placeholders,
			};
		}

		if (this.source[this.index] === '}') {
			this.index++;
			return { index: placeholderIndex, text: '', inner: [] };
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
			if (!name || !BUILTIN_VARIABLES.has(name)) {
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
		if (!name || !BUILTIN_VARIABLES.has(name)) {
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
