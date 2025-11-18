import { SnippetEngine } from '../src/snippetEngine';
import { processSnippetBody } from '../src/snippetBody';
import type { ParsedSnippet } from '../src/types';

describe('SnippetEngine advanced matching', () => {
	const buildSnippet = (prefix: string, body: string): ParsedSnippet => {
		const processed = processSnippetBody(body);
		return {
			prefix,
			body,
			description: '',
			processedText: processed.text,
			tabStops: processed.tabStops,
			variables: processed.variables,
		};
	};

	it('prefers longest matching prefix when overlaps exist', () => {
		const engine = new SnippetEngine([
			buildSnippet('log', 'console.log($1);'),
			buildSnippet('logerr', 'console.error($1);'),
		]);

		const result = engine.matchSnippetInContext('logerr');
		expect(result?.prefix).toBe('logerr');
	});

	it('ignores matches shorter than registered min length', () => {
		const engine = new SnippetEngine([buildSnippet('abcde', 'text')]);
		const result = engine.matchSnippetInContext('abc');
		expect(result).toBeUndefined();
	});

	it('returns undefined when context exceeds but does not end with prefix', () => {
		const engine = new SnippetEngine([buildSnippet('hello', 'text')]);
		const result = engine.matchSnippetInContext('foohell');
		expect(result).toBeUndefined();
	});

	it('is case sensitive', () => {
		const engine = new SnippetEngine([buildSnippet('Hello', 'text')]);
		const mismatch = engine.matchSnippetInContext('hello');
		expect(mismatch).toBeUndefined();
		const match = engine.matchSnippetInContext('SayHello');
		expect(match?.prefix).toBe('Hello');
	});

	it('trims context to max prefix length before matching', () => {
		const engine = new SnippetEngine([buildSnippet('xyz', 'text')]);
		const ctx = 'prefixxyz';
		const result = engine.matchSnippetInContext(ctx);
		expect(result?.prefix).toBe('xyz');
	});

	it('extracts matched prefix boundaries correctly', () => {
		const engine = new SnippetEngine([buildSnippet('test', 'text')]);
		const snippet = engine.getSnippets()[0];
		const line = 'xx test';
		const info = engine.extractMatchedPrefix(line, line.length, snippet.prefix);
		expect(info.start).toBe(3);
		expect(info.end).toBe(7);
		expect(info.prefix).toBe('test');
	});
});
