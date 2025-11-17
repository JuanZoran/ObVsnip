import { PluginLogger } from './logger';
import { TabStopInfo } from './types';

export interface ProcessedSnippetBody {
	text: string;
	tabStops: TabStopInfo[];
}

export const processSnippetBody = (body: string, logger?: PluginLogger): ProcessedSnippetBody => {
	logger?.debug(`\n📝 Processing snippet body: "${body}"`);
	const parser = new SnippetBodyParser(body);
	const parsed = parser.parse();

	const stopsMap: Map<number, TabStopInfo> = new Map();
	for (const stop of parsed.placeholders) {
		stopsMap.set(stop.index, stop);
	}

	if (!stopsMap.has(0)) {
		stopsMap.set(0, {
			index: 0,
			start: parsed.text.length,
			end: parsed.text.length,
		});
		logger?.debug(`    → Added implicit $0 at position ${parsed.text.length}`);
	}

	logger?.debug(`\n✅ Final text: "${parsed.text}"`);
	logger?.debug(`   Length: ${parsed.text.length}`);

	const tabStops = Array.from(stopsMap.values()).sort((a, b) => a.index - b.index);
	logger?.debug(`📍 Tab stops:`);
	tabStops.forEach(stop => {
		logger?.debug(`   $${stop.index}: start=${stop.start}, end=${stop.end}`);
	});

	return {
		text: parsed.text,
		tabStops,
	};
};

interface ParsedPlaceholderRange {
	index: number;
	start: number;
	end: number;
}

interface SegmentParseResult {
	text: string;
	placeholders: ParsedPlaceholderRange[];
	terminated: boolean;
}

interface PlaceholderParseResult {
	index: number;
	text: string;
	inner: ParsedPlaceholderRange[];
}

class SnippetBodyParser {
	private index = 0;

	constructor(private readonly source: string) {}

	parse(): { text: string; placeholders: ParsedPlaceholderRange[] } {
		const segment = this.parseSegment();
		return {
			text: segment.text,
			placeholders: segment.placeholders,
		};
	}

	private parseSegment(terminator?: string): SegmentParseResult {
		let text = '';
		const placeholders: ParsedPlaceholderRange[] = [];
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
					placeholders.push({ index: placeholder.index, start, end });
					for (const inner of placeholder.inner) {
						placeholders.push({
							index: inner.index,
							start: start + inner.start,
							end: start + inner.end,
						});
					}
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

		return { text, placeholders, terminated };
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
}
