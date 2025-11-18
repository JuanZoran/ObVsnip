import { App, __noticeMessages } from "obsidian";
import { SnippetManager } from "../src/snippetManager";
import { SnippetEngine } from "../src/snippetEngine";
import { PluginLogger } from "../src/logger";
import { processSnippetBody } from "../src/snippetBody";
import { MockEditor } from "./mocks/editor";

jest.mock("../src/variableResolver", () => ({
	resolveVariableValue: jest.fn(),
}));

import { resolveVariableValue } from "../src/variableResolver";

describe("SnippetManager variable interactions", () => {
	beforeEach(() => {
		(resolveVariableValue as jest.Mock).mockReset();
		__noticeMessages.length = 0;
	});

	it("shifts tab stop offsets after variable substitution", () => {
		const processed = processSnippetBody(
			"${1:foo} ${TM_SELECTED_TEXT:} ${2|A,B|}"
		);
		const manager = new SnippetManager(
			new App() as any,
			new SnippetEngine([]),
			new PluginLogger()
		);
		const editor = new MockEditor("");

		(resolveVariableValue as jest.Mock).mockReturnValue({ value: "XYZ" });

		const beforeStop2 = processed.tabStops.find((stop) => stop.index === 2);
		expect(beforeStop2).toBeDefined();

		const result = (manager as any).applyVariablesToText(
			processed.text,
			processed.tabStops.map((stop) => ({ ...stop })),
			processed.variables,
			editor as any
		);

		const afterStop2 = result.tabStops.find((stop) => stop.index === 2);
		expect(afterStop2).toBeDefined();
		if (beforeStop2 && afterStop2) {
			expect(afterStop2.start - beforeStop2.start).toBe(3);
			expect(result.text).toContain("XYZ");
		}
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

		(resolveVariableValue as jest.Mock).mockReturnValue({
			value: null,
			reason: "No selection",
		});

		const result = (manager as any).applyVariablesToText(
			processed.text,
			processed.tabStops.map((stop) => ({ ...stop })),
			processed.variables,
			editor as any
		);

		expect(result.text).toContain("Fallback");
		expect(__noticeMessages.length).toBeGreaterThan(0);
		const lastNotice = __noticeMessages[__noticeMessages.length - 1];
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

		(resolveVariableValue as jest.Mock)
			.mockReturnValueOnce({ value: "file.md" })
			.mockReturnValueOnce({ value: null, reason: "No selection" })
			.mockReturnValueOnce({ value: null, reason: "Unknown variable" });

		const result = (manager as any).applyVariablesToText(
			processed.text,
			processed.tabStops.map((stop) => ({ ...stop })),
			processed.variables,
			editor as any
		);

		expect(result.text).toContain("file.md");
		expect(result.text).toContain("default");
		expect(__noticeMessages.length).toBeGreaterThanOrEqual(1);
	});

	it("returns original structures when no variables provided", () => {
		const manager = new SnippetManager(
			new App() as any,
			new SnippetEngine([]),
			new PluginLogger()
		);
		const editor = new MockEditor("");
		const processed = processSnippetBody("${1:placeholder}");
		const result = (manager as any).applyVariablesToText(
			processed.text,
			processed.tabStops.map((stop) => ({ ...stop })),
			undefined,
			editor as any
		);
		expect(result.text).toBe(processed.text);
		expect(result.tabStops).toHaveLength(processed.tabStops.length);
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

		(resolveVariableValue as jest.Mock).mockReturnValue({
			value: "Universe",
		});

		const beforeStop = processed.tabStops.find((stop) => stop.index === 1);
		const result = (manager as any).applyVariablesToText(
			processed.text,
			processed.tabStops.map((stop) => ({ ...stop })),
			processed.variables,
			editor as any
		);

		const afterStop = result.tabStops.find((stop) => stop.index === 1);
		expect(result.text).toContain("Hello Universe");
		expect(afterStop && beforeStop).toBeDefined();
		if (afterStop && beforeStop) {
			expect(afterStop.end - afterStop.start).toBe(
				"Hello Universe".length
			);
			expect(afterStop.start).toBe(beforeStop.start);
		}
	});
});
