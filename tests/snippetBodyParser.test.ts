import * as snippetBody from '../src/snippetBody';
import { SnippetParser } from '../src/snippetParser';

const { processSnippetBody } = snippetBody;

const getStop = (tabStops: ReturnType<typeof processSnippetBody>['tabStops'], index: number) =>
	tabStops.find((stop) => stop.index === index);

describe('processSnippetBody edge cases', () => {
	it('parses nested placeholders and adds implicit $0', () => {
		const result = processSnippetBody('Before ${1:outer ${2:inner}} After');
		expect(result.text).toBe('Before outer inner After');

		const stop1 = getStop(result.tabStops, 1);
		const stop2 = getStop(result.tabStops, 2);
		const stop0 = getStop(result.tabStops, 0);

		expect(stop1).toMatchObject({ start: 7, end: 18 });
		expect(stop2).toMatchObject({ start: 13, end: 18 });
		expect(stop0?.start).toBe(result.text.length);
		expect(stop0?.end).toBe(result.text.length);
	});

	it('captures choice lists and escaped sequences', () => {
		const body = 'Price \\$${1|10,20|} (fallback ${2})';
		const result = processSnippetBody(body);

		expect(result.text).toBe('Price $10 (fallback )');
		const stop1 = getStop(result.tabStops, 1);
		expect(stop1?.choices).toEqual(['10', '20']);
		const stop2 = getStop(result.tabStops, 2);
		expect(stop2?.start).toBe(stop2?.end);
		expect(stop2?.start).toBe(result.text.length - 1);
	});

	it('records variables with default values', () => {
		const body = 'File ${TM_FILENAME} year ${CURRENT_YEAR:2024}';
		const result = processSnippetBody(body);

		expect(result.variables.map((variable) => variable.name)).toEqual([
			'TM_FILENAME',
			'CURRENT_YEAR',
		]);
		const currentYear = result.variables.find(
			(variable) => variable.name === 'CURRENT_YEAR'
		);
		expect(currentYear).toBeDefined();
		expect(currentYear?.defaultValue).toBe('2024');
		expect((currentYear?.end ?? 0) - (currentYear?.start ?? 0)).toBe(4);
	});

	it('adjusts offsets when nested tab stops overlap', () => {
		const body = 'Value ${1:${2|one,two|} inner} done';
		const result = processSnippetBody(body);

		const stop1 = getStop(result.tabStops, 1);
		const stop2 = getStop(result.tabStops, 2);

		expect(result.text).toBe('Value one inner done');
		expect(stop1?.start).toBe(6);
		expect(stop1?.end).toBe(15);
		expect(stop2?.start).toBe(stop1?.start);
		expect(stop2).toBeDefined();
	});

	it('ignores invalid placeholders and escaped errors gracefully', () => {
		const body = 'Broken ${1 invalid ${2} \\${notvar}';
		const result = processSnippetBody(body);
		expect(result.text).toContain('Broken');
		expect(result.tabStops.some((stop) => stop.index === 1)).toBe(false);
	});

	it('recovers from malformed placeholders and maintains later stops', () => {
		const body =
			'Edge ${1:first} ${broken ${2:good}} text ${3|a,b|} \\${escaped}';
		const result = processSnippetBody(body);

		expect(result.tabStops.map((stop) => stop.index)).toEqual([0, 1, 2, 3]);
		const stop2 = getStop(result.tabStops, 2);
		const stop3 = getStop(result.tabStops, 3);

		expect(stop2).toBeDefined();
		expect(stop3?.choices).toEqual(['a', 'b']);
		expect(result.text).toContain('Edge first');
		expect(result.text).toContain('good');
		expect(result.text).toContain('${escaped}');
	});
});

describe('SnippetParser.parseJson', () => {
	it('parses VSCode snippets with array bodies and preserves metadata', () => {
		const json = JSON.stringify({
			log: {
				prefix: 'log',
				body: ['console.log(${1:value});', '$0'],
				description: 'Console log value',
				hide: true,
				priority: 5,
			},
			invalid: {
				body: 'missing prefix should be skipped',
			},
		});

		const snippets = SnippetParser.parseJson(json);
		expect(snippets).toHaveLength(1);
		const snippet = snippets[0];
		expect(snippet.body).toBe('console.log(${1:value});\n$0');
		expect(snippet.processedText).toBe('console.log(value);\n');
		expect(snippet.description).toBe('Console log value');
		expect(snippet.hide).toBe(true);
		expect(snippet.priority).toBe(5);
		expect(snippet.tabStops.map((stop) => stop.index)).toEqual([0, 1]);
	});

	it('throws on malformed JSON and invalid snippets', () => {
		expect(() => SnippetParser.parseJson('{ invalid json')).toThrow();

		const malformed = JSON.stringify({
			bad: { prefix: 123, body: null },
		});
		expect(SnippetParser.parseJson(malformed)).toEqual([]);
	});

	it('skips invalid snippet entries inside valid JSON', () => {
		const json = JSON.stringify([
			{ prefix: 'ok', body: 'body' },
			{ prefix: 123 as any, body: 'bad' },
		]);
		const snippets = SnippetParser.parseJson(json);
		expect(snippets).toHaveLength(1);
		expect(snippets[0].prefix).toBe('ok');
	});

	it('propagates processSnippetBody errors', () => {
		const spy = jest.spyOn(snippetBody, 'processSnippetBody').mockImplementation(() => {
			throw new Error('bad placeholder');
		});
		const json = JSON.stringify({ demo: { prefix: 'demo', body: 'body' } });
		expect(() => SnippetParser.parseJson(json)).toThrow(/bad placeholder/);
		spy.mockRestore();
	});
});
