import { getCursorContext } from "../src/utils/editorContext";
import { filterSnippetsByContext } from "../src/utils/snippetContext";
import { MockEditor } from "./mocks/editor";
import type { ParsedSnippet } from "../src/types";

const createSnippet = (prefix: string, source?: string): ParsedSnippet => ({
	prefix,
	body: prefix,
	processedText: prefix,
	tabStops: [],
	source,
});

describe("getCursorContext", () => {
	it("detects fenced code block with language", () => {
		const editor = new MockEditor("```js\nconsole.log()\n");
		editor.setCursor({ line: 1, ch: 0 });
		const ctx = getCursorContext(editor as any);
		expect(ctx.inCodeBlock).toBe(true);
		expect(ctx.codeLang).toBe("js");
		expect(ctx.inInlineCode).toBe(false);
	});

	it("detects inline code backticks", () => {
		const line = "before `code` after";
		const cursorPos = line.indexOf("code") + 2; // inside inline code
		const editor = new MockEditor(line);
		editor.setCursor({ line: 0, ch: cursorPos });
		const ctx = getCursorContext(editor as any);
		expect(ctx.inInlineCode).toBe(true);
		expect(ctx.inCodeBlock).toBe(false);
	});

	it("detects inline math", () => {
		const line = "value $x$ end";
		const cursorPos = line.indexOf("x"); // inside $
		const editor = new MockEditor(line);
		editor.setCursor({ line: 0, ch: cursorPos });
		const ctx = getCursorContext(editor as any);
		expect(ctx.inInlineMath).toBe(true);
		expect(ctx.inMathBlock).toBe(false);
	});
});

describe("filterSnippetsByContext", () => {
	it("respects codeblock language and markdown scopes", () => {
		const snippets = [
			createSnippet("codeOnly", "a.json"),
			createSnippet("markdownOnly", "b.json"),
		];
		const configs = {
			"a.json": {
				path: "a.json",
				enabled: true,
				contexts: [{ scope: "codeblock", languages: ["js"] }],
			},
			"b.json": {
				path: "b.json",
				enabled: true,
				contexts: [{ scope: "markdown" }],
			},
		};

		const codeCtx = getCursorContext(new MockEditor("```js\nconsole.log()\n") as any);
		const markdownCtx = getCursorContext(new MockEditor("plain text") as any);

		const codeFiltered = filterSnippetsByContext(snippets, codeCtx, configs);
		expect(codeFiltered.map((s) => s.prefix)).toEqual(["codeOnly"]);

		const mdFiltered = filterSnippetsByContext(snippets, markdownCtx, configs);
		expect(mdFiltered.map((s) => s.prefix)).toEqual(["markdownOnly"]);
	});
});
