import { getContextBeforeCursor } from '../src/utils/prefixContext';
import { MockEditor } from './mocks/editor';
import type { PrefixInfo } from '../src/types';

describe('getContextBeforeCursor', () => {
	it('extracts text before cursor correctly', () => {
		const editor = new MockEditor('hello world');
		editor.setCursor({ line: 0, ch: 5 });
		const prefixInfo: PrefixInfo = { maxLength: 10 };

		const result = getContextBeforeCursor({
			editor: editor as any,
			prefixInfo,
		});

		expect(result).not.toBeNull();
		expect(result?.text).toBe('hello');
		expect(result?.startOffset).toBe(0);
		expect(result?.endOffset).toBe(5);
	});

	it('respects maxLength limit', () => {
		const editor = new MockEditor('this is a very long text');
		editor.setCursor({ line: 0, ch: 25 });
		const prefixInfo: PrefixInfo = { maxLength: 5 };

		const result = getContextBeforeCursor({
			editor: editor as any,
			prefixInfo,
		});

		expect(result).not.toBeNull();
		expect(result?.text).toBe('text');
		expect(result?.startOffset).toBe(20); // 25 - 5
		expect(result?.endOffset).toBe(25);
	});

	it('handles cursor at document start', () => {
		const editor = new MockEditor('hello');
		editor.setCursor({ line: 0, ch: 0 });
		const prefixInfo: PrefixInfo = { maxLength: 10 };

		const result = getContextBeforeCursor({
			editor: editor as any,
			prefixInfo,
		});

		expect(result).not.toBeNull();
		expect(result?.text).toBe('');
		expect(result?.startOffset).toBe(0);
		expect(result?.endOffset).toBe(0);
	});

	it('handles cursor at document end', () => {
		const editor = new MockEditor('hello');
		editor.setCursor({ line: 0, ch: 5 });
		const prefixInfo: PrefixInfo = { maxLength: 10 };

		const result = getContextBeforeCursor({
			editor: editor as any,
			prefixInfo,
		});

		expect(result).not.toBeNull();
		expect(result?.text).toBe('hello');
		expect(result?.startOffset).toBe(0);
		expect(result?.endOffset).toBe(5);
	});

	it('handles multi-line document', () => {
		const editor = new MockEditor('line1\nline2\nline3');
		editor.setCursor({ line: 2, ch: 3 });
		const prefixInfo: PrefixInfo = { maxLength: 20 };

		const result = getContextBeforeCursor({
			editor: editor as any,
			prefixInfo,
		});

		expect(result).not.toBeNull();
		// Should include parts of previous lines if within maxLength
		expect(result?.text).toContain('lin');
		expect(result?.endOffset).toBeGreaterThan(0);
	});

	it('handles maxLength of 0', () => {
		const editor = new MockEditor('hello');
		editor.setCursor({ line: 0, ch: 3 });
		const prefixInfo: PrefixInfo = { maxLength: 0 };

		const result = getContextBeforeCursor({
			editor: editor as any,
			prefixInfo,
		});

		expect(result).toBeNull();
	});

	it('handles missing prefixInfo', () => {
		const editor = new MockEditor('hello');
		editor.setCursor({ line: 0, ch: 3 });
		const prefixInfo: PrefixInfo = {} as any;

		const result = getContextBeforeCursor({
			editor: editor as any,
			prefixInfo,
		});

		expect(result).toBeNull();
	});

	it('handles prefixInfo with undefined maxLength', () => {
		const editor = new MockEditor('hello');
		editor.setCursor({ line: 0, ch: 3 });
		const prefixInfo: PrefixInfo = { maxLength: undefined as any };

		const result = getContextBeforeCursor({
			editor: editor as any,
			prefixInfo,
		});

		expect(result).toBeNull();
	});

	it('calculates startOffset correctly when maxLength is less than cursor position', () => {
		const editor = new MockEditor('abcdefghijklmnop');
		editor.setCursor({ line: 0, ch: 10 });
		const prefixInfo: PrefixInfo = { maxLength: 5 };

		const result = getContextBeforeCursor({
			editor: editor as any,
			prefixInfo,
		});

		expect(result).not.toBeNull();
		expect(result?.startOffset).toBe(5); // 10 - 5
		expect(result?.endOffset).toBe(10);
		expect(result?.text).toBe('fghij');
	});

	it('handles cursor position at start of line in multi-line document', () => {
		const editor = new MockEditor('line1\nline2');
		editor.setCursor({ line: 1, ch: 0 });
		const prefixInfo: PrefixInfo = { maxLength: 10 };

		const result = getContextBeforeCursor({
			editor: editor as any,
			prefixInfo,
		});

		expect(result).not.toBeNull();
		// Should include newline and part of previous line
		expect(result?.text).toContain('\n');
		expect(result?.endOffset).toBe(6); // Position of start of line2 (line1\n = 6 chars)
	});

	it('handles very long maxLength', () => {
		const editor = new MockEditor('short');
		editor.setCursor({ line: 0, ch: 5 });
		const prefixInfo: PrefixInfo = { maxLength: 1000 };

		const result = getContextBeforeCursor({
			editor: editor as any,
			prefixInfo,
		});

		expect(result).not.toBeNull();
		expect(result?.text).toBe('short');
		expect(result?.startOffset).toBe(0);
		expect(result?.endOffset).toBe(5);
	});

	it('handles empty document', () => {
		const editor = new MockEditor('');
		editor.setCursor({ line: 0, ch: 0 });
		const prefixInfo: PrefixInfo = { maxLength: 10 };

		const result = getContextBeforeCursor({
			editor: editor as any,
			prefixInfo,
		});

		expect(result).not.toBeNull();
		expect(result?.text).toBe('');
		expect(result?.startOffset).toBe(0);
		expect(result?.endOffset).toBe(0);
	});
});

