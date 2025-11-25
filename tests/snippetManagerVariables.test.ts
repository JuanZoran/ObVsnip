import { App, __noticeMessages } from "obsidian";
import { SnippetManager } from "../src/snippetManager";
import { SnippetEngine } from "../src/snippetEngine";
import { PluginLogger } from "../src/logger";
import { processSnippetBody } from "../src/snippetBody";
import { MockEditor, MockEditorView } from "./mocks/editor";

jest.mock("../src/variableResolver", () => ({
	resolveVariableValue: jest.fn(),
}));

import { resolveVariableValue } from "../src/variableResolver";
jest.mock("../src/utils/editorUtils", () => ({
	getActiveEditor: jest.fn(),
	getEditorView: jest.fn(),
}));

import { getActiveEditor, getEditorView } from "../src/utils/editorUtils";

describe("SnippetManager variable interactions", () => {
	beforeEach(() => {
		(resolveVariableValue as jest.Mock).mockReset();
		__noticeMessages.length = 0;
		(getActiveEditor as jest.Mock).mockReset();
		(getEditorView as jest.Mock).mockReset();
	});

	it("positions later tab stops after variable substitution", () => {
		const processed = processSnippetBody(
			"${1:foo} ${TM_SELECTED_TEXT:} ${2|A,B|}"
		);
		const manager = new SnippetManager(
			new App() as any,
			new SnippetEngine([]),
			new PluginLogger()
		);
		const editor = new MockEditor("");
		const view = new MockEditorView("");
		(getEditorView as jest.Mock).mockReturnValue(view);
		(getActiveEditor as jest.Mock).mockReturnValue(editor);

		(resolveVariableValue as jest.Mock).mockReturnValue({ value: "XYZ" });

		const snippet = {
			prefix: "vars",
			body: "${1:foo} ${TM_SELECTED_TEXT:} ${2|A,B|}",
			description: "",
			processedText: processed.text,
			tabStops: processed.tabStops,
			variables: processed.variables,
		};

		expect(manager.applySnippetAtCursor(snippet as any, editor as any)).toBe(true);
		expect(editor.getText()).toBe("foo XYZ A");
		expect(editor.getSelection()).toBe("foo");

		expect(manager.jumpToNextTabStop()).toBe(true);
		expect(editor.getSelection()).toBe("A");
		const fromOffset = editor.posToOffset(editor.getCursor("from"));
		expect(editor.getText().slice(0, fromOffset)).toBe("foo XYZ ");
	});

	it("falls back to default value and emits notice when variable missing", () => {
		const processed = processSnippetBody(
			"${TM_SELECTED_TEXT:Fallback} tail"
		);
		const manager = new SnippetManager(
			new App() as any,
			new SnippetEngine([]),
			new PluginLogger()
		);
		const editor = new MockEditor("");
		const view = new MockEditorView("");
		(getEditorView as jest.Mock).mockReturnValue(view);
		(getActiveEditor as jest.Mock).mockReturnValue(editor);

		(resolveVariableValue as jest.Mock).mockReturnValue({
			value: null,
			reason: "No selection",
		});

		const snippet = {
			prefix: "fallback",
			body: "${TM_SELECTED_TEXT:Fallback} tail",
			description: "",
			processedText: processed.text,
			tabStops: processed.tabStops,
			variables: processed.variables,
		};

		expect(manager.applySnippetAtCursor(snippet as any, editor as any)).toBe(true);
		expect(editor.getText()).toContain("Fallback");
		expect(__noticeMessages.length).toBeGreaterThan(0);
		const lastNotice = __noticeMessages[__noticeMessages.length - 1];
		expect(manager.jumpToNextTabStop({ silent: true })).toBe(false);
		expect(lastNotice).toContain("TM_SELECTED_TEXT");
		expect(lastNotice).toContain("Fallback");
	});

	it("handles mixed variable outcomes", () => {
		const processed = processSnippetBody(
			"${TM_FILENAME} ${TM_SELECTED_TEXT:default} ${UNKNOWN_VAR}"
		);
		const manager = new SnippetManager(
			new App() as any,
			new SnippetEngine([]),
			new PluginLogger()
		);
		const editor = new MockEditor("");
		const view = new MockEditorView("");
		(getEditorView as jest.Mock).mockReturnValue(view);
		(getActiveEditor as jest.Mock).mockReturnValue(editor);

		(resolveVariableValue as jest.Mock)
			.mockReturnValueOnce({ value: "file.md" })
			.mockReturnValueOnce({ value: null, reason: "No selection" })
			.mockReturnValueOnce({ value: null, reason: "Unknown variable" });

		const snippet = {
			prefix: "mixed",
			body: "${TM_FILENAME} ${TM_SELECTED_TEXT:default} ${UNKNOWN_VAR}",
			description: "",
			processedText: processed.text,
			tabStops: processed.tabStops,
			variables: processed.variables,
		};

		expect(manager.applySnippetAtCursor(snippet as any, editor as any)).toBe(true);
		expect(manager.jumpToNextTabStop({ silent: true })).toBe(false);
		expect(manager.isSnippetActive(editor as any)).toBe(false);

		expect(editor.getText()).toContain("file.md");
		expect(editor.getText()).toContain("default");
		expect(__noticeMessages.length).toBeGreaterThanOrEqual(1);
	});

	it("expands snippet unchanged when no variables exist", () => {
		const manager = new SnippetManager(
			new App() as any,
			new SnippetEngine([]),
			new PluginLogger()
		);
		const editor = new MockEditor("");
		const view = new MockEditorView("");
		(getEditorView as jest.Mock).mockReturnValue(view);
		(getActiveEditor as jest.Mock).mockReturnValue(editor);

		const processed = processSnippetBody("${1:placeholder}");
		const snippet = {
			prefix: "plain",
			body: "${1:placeholder}",
			description: "",
			processedText: processed.text,
			tabStops: processed.tabStops,
			variables: processed.variables,
		};

		expect(manager.applySnippetAtCursor(snippet as any, editor as any)).toBe(true);
		expect(editor.getText()).toBe("placeholder");
		expect(editor.getSelection()).toBe("placeholder");
		expect(manager.jumpToNextTabStop()).toBe(false);
	});

	it("recomputes tab stop bounds when nested variable changes length", () => {
		const processed = processSnippetBody(
			"Value ${1:Hello ${TM_SELECTED_TEXT}} done"
		);
		const manager = new SnippetManager(
			new App() as any,
			new SnippetEngine([]),
			new PluginLogger()
		);
		const editor = new MockEditor("");
		const view = new MockEditorView("");
		(getEditorView as jest.Mock).mockReturnValue(view);
		(getActiveEditor as jest.Mock).mockReturnValue(editor);

		(resolveVariableValue as jest.Mock).mockReturnValue({
			value: "Universe",
		});

		const snippet = {
			prefix: "nested",
			body: "Value ${1:Hello ${TM_SELECTED_TEXT}} done",
			description: "",
			processedText: processed.text,
			tabStops: processed.tabStops,
			variables: processed.variables,
		};

		expect(manager.applySnippetAtCursor(snippet as any, editor as any)).toBe(true);
		expect(editor.getSelection()).toBe("Hello Universe");
		expect(editor.getText()).toContain("Value Hello Universe done");

		const from = editor.getCursor("from");
		const to = editor.getCursor("to");
		expect(from).toEqual({ line: 0, ch: 6 });
		const length = editor.posToOffset(to) - editor.posToOffset(from);
		expect(length).toBe("Hello Universe".length);
		expect(manager.jumpToNextTabStop()).toBe(false);
	});
});
