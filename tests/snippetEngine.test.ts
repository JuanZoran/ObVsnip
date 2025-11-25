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

	it('prefers nearest substring constraints over longer overlapping prefixes', () => {
		const engine = new SnippetEngine([
			buildSnippet('t', 'text'),
			buildSnippet('xt', 'text'),
		]);

		const result = engine.matchSnippetInContext('xt');
		expect(result?.prefix).toBe('t');
	});

	it('handles empty snippet list', () => {
		const engine = new SnippetEngine([]);
		const result = engine.matchSnippetInContext('test');
		expect(result).toBeUndefined();
		expect(engine.getSnippets()).toEqual([]);
	});

	it('calculates prefix length range correctly for empty list', () => {
		const engine = new SnippetEngine([]);
		const prefixInfo = engine.getPrefixInfo();
		expect(prefixInfo.minLength).toBe(0);
		expect(prefixInfo.maxLength).toBe(0);
	});

	it('calculates prefix length range correctly for single snippet', () => {
		const engine = new SnippetEngine([buildSnippet('test', 'content')]);
		const prefixInfo = engine.getPrefixInfo();
		expect(prefixInfo.minLength).toBe(4);
		expect(prefixInfo.maxLength).toBe(4);
	});

	it('calculates prefix length range correctly for multiple snippets', () => {
		const engine = new SnippetEngine([
			buildSnippet('a', 'content'),
			buildSnippet('ab', 'content'),
			buildSnippet('abc', 'content'),
			buildSnippet('abcd', 'content'),
		]);
		const prefixInfo = engine.getPrefixInfo();
		expect(prefixInfo.minLength).toBe(1);
		expect(prefixInfo.maxLength).toBe(4);
	});

	it('updates prefix length range when snippets are updated', () => {
		const engine = new SnippetEngine([buildSnippet('short', 'content')]);
		expect(engine.getPrefixInfo().maxLength).toBe(5);

		engine.setSnippets([
			buildSnippet('a', 'content'),
			buildSnippet('verylongprefix', 'content'),
		]);
		const prefixInfo = engine.getPrefixInfo();
		expect(prefixInfo.minLength).toBe(1);
		expect(prefixInfo.maxLength).toBe(14);
	});

	it('returns undefined when matching with empty context', () => {
		const engine = new SnippetEngine([buildSnippet('test', 'content')]);
		const result = engine.matchSnippetInContext('');
		expect(result).toBeUndefined();
	});

	it('handles context shorter than min prefix length', () => {
		const engine = new SnippetEngine([buildSnippet('abcde', 'content')]);
		const result = engine.matchSnippetInContext('ab');
		expect(result).toBeUndefined();
	});

	it('handles context exactly at min prefix length', () => {
		const engine = new SnippetEngine([
			buildSnippet('ab', 'content'),
			buildSnippet('abc', 'content'),
		]);
		const result = engine.matchSnippetInContext('ab');
		expect(result?.prefix).toBe('ab');
	});

	it('handles context longer than max prefix length', () => {
		const engine = new SnippetEngine([buildSnippet('test', 'content')]);
		const longContext = 'a'.repeat(100) + 'test';
		const result = engine.matchSnippetInContext(longContext);
		expect(result?.prefix).toBe('test');
	});
});
