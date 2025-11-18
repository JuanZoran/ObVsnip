import { App, Editor, Notice } from "obsidian";
import type { EditorPosition } from "obsidian";
import type { EditorView } from "@codemirror/view";
import { SnippetEngine } from "./snippetEngine";
import { PluginLogger } from "./logger";
import { ParsedSnippet, TabStopInfo, SnippetVariableInfo } from "./types";
import { processSnippetBody } from "./snippetBody";
import {
    pushSnippetSessionEffect,
    popSnippetSessionEffect,
    updateSnippetSessionEffect,
    clearSnippetSessionsEffect,
    snippetSessionField,
    SnippetSessionStop,
    SnippetSessionEntry,
    getSnippetSessionStack,
} from './snippetSession';
import { getActiveEditor, getEditorView } from "./editorUtils";
import { resolveVariableValue } from "./variableResolver";
import { getContextBeforeCursor } from "./prefixContext";

type JumpCandidate = {
    index: number;
    stop: SnippetSessionStop;
};

export class SnippetManager {
	constructor(private app: App, private snippetEngine: SnippetEngine, private logger: PluginLogger) {}

    expandSnippet(): boolean {
        const editor = getActiveEditor(this.app);
        if (!editor) {
            new Notice('No active editor');
            return false;
        }

        const match = this.findSnippetMatch(editor);
        if (!match) {
            return false;
        }

        const startPos = editor.offsetToPos(match.startOffset);
        const endPos = editor.offsetToPos(match.endOffset);

        return this.insertSnippet(editor, match.snippet, startPos, endPos);
    }

    jumpToNextTabStop(options?: { silent?: boolean }): boolean {
        const silent = options?.silent ?? false;
        const editor = getActiveEditor(this.app);
        if (!editor) return false;

        const snippetState = this.getSnippetState(editor);
        if (!snippetState.active || !snippetState.stack?.length) {
            if (!silent) new Notice('⚠️ Not in snippet mode');
            return false;
        }

        const session = snippetState.stack.at(-1)!;
        this.logger.debug("manager", `\n⏭️  JUMP from $${session.currentIndex}:`);

        const candidate = this.selectNextTabStop(session);
        if (!candidate) {
            this.logger.debug("manager", `  ❌ No more tab stops, exiting snippet mode`);
            this.forceExitSnippetMode(getEditorView(editor) ?? undefined);
            if (!silent) new Notice('✅ No more tab stops');
            return false;
        }

        return this.completeNextJumpTransition(editor, session, candidate, options);
    }

    jumpToPrevTabStop(options?: { silent?: boolean }): boolean {
        const silent = options?.silent ?? false;
        const editor = getActiveEditor(this.app);
        if (!editor) return false;

        const snippetState = this.getSnippetState(editor);
        if (!snippetState.active || !snippetState.stack?.length) {
            if (!silent) new Notice('⚠️ Not in snippet mode');
            return false;
        }

        const session = snippetState.stack.at(-1)!;
        this.logger.debug("manager", `← JUMP from $${session.currentIndex}:`);

        const candidate = this.selectPrevTabStop(session);
        if (!candidate) {
            if (!silent) new Notice('⏮️ No previous tab stops');
            return false;
        }

        return this.completePrevJumpTransition(editor, session, candidate, options);
    }

    forceExitSnippetMode(view?: EditorView): boolean {
        let targetView: EditorView | undefined = view;
        if (!targetView) {
            const editor = getActiveEditor(this.app);
            if (editor) {
                const resolved = getEditorView(editor);
                if (resolved) {
                    targetView = resolved;
                }
            }
        }
        if (!targetView) {
            return false;
        }

        let stack: SnippetSessionEntry[] | undefined;
        try {
            stack = targetView.state.field(snippetSessionField);
        } catch {
            stack = undefined;
        }

        if (!stack || stack.length === 0) {
            return false;
        }

        targetView.dispatch({ effects: clearSnippetSessionsEffect.of(undefined) });
        this.logger.debug("manager", '🔴 Exited snippet mode via force exit');
        return true;
    }

	private pushSnippetSession(editor: Editor, baseOffset: number, tabStops: TabStopInfo[], initialIndex: number): void {
		const view = getEditorView(editor);
		if (!view) return;
		const stops: SnippetSessionStop[] = tabStops
			.map((stop) => ({
				index: stop.index,
				start: baseOffset + stop.start,
				end: baseOffset + stop.end,
				choices: stop.choices,
			}))
			.sort((a, b) => {
				if (a.start !== b.start) return a.start - b.start;
				if (a.end !== b.end) return a.end - b.end;
				return a.index - b.index;
			});
		const choiceStops = stops.filter(
			(stop) => stop.choices && stop.choices.length > 0
		);
		if (choiceStops.length > 0) {
			const choiceSummary = choiceStops
				.map(
					(stop) => `$${stop.index}[${(stop.choices ?? []).join(", ")}]`
				)
				.join(", ");
			this.logger.debug(
				"manager",
				`🧩 Choice tab stops detected: ${choiceSummary}`
			);
		}
		view.dispatch({
			effects: pushSnippetSessionEffect.of({
				currentIndex: initialIndex,
				stops,
			}),
		});
	}

    private updateSnippetSessionIndex(editor: Editor, currentIndex: number): void {
        const view = getEditorView(editor);
        if (!view) return;
        view.dispatch({ effects: updateSnippetSessionEffect.of({ currentIndex }) });
    }

    private getSessionEntries(editor: Editor): SnippetSessionEntry[] | null {
        const { stack } = this.getSnippetState(editor);
        return stack;
    }

    private getSnippetState(editor: Editor): {
        active: boolean;
        stack: SnippetSessionEntry[] | null;
    } {
        const view = getEditorView(editor);
        if (!view) {
            return { active: false, stack: null };
        }
        const stack = getSnippetSessionStack(view);
        return { active: !!stack && stack.length > 0, stack };
    }

    public isSnippetActive(editor: Editor): boolean {
        return this.getSnippetState(editor).active;
    }

    private insertSnippet(editor: Editor, snippet: ParsedSnippet, startPos: EditorPosition, endPos: EditorPosition): boolean {
        let text = snippet.processedText;
        let tabStops = snippet.tabStops;
        let variables = snippet.variables;
        if (!text || !tabStops || tabStops.length === 0 || !variables) {
            const processed = processSnippetBody(snippet.body, this.logger);
            text = processed.text;
            tabStops = processed.tabStops;
            variables = processed.variables;
            snippet.processedText = text;
            snippet.tabStops = tabStops;
            snippet.variables = variables;
        }

        const variableResult = this.applyVariablesToText(
            text,
            tabStops,
            variables,
            editor
        );
        text = variableResult.text;
        tabStops = variableResult.tabStops;

        editor.replaceRange(text, startPos, endPos);

        const baseOffset = editor.posToOffset(startPos);
		const positiveStops = tabStops.filter((t) => t.index > 0);
		const firstTabStop =
			positiveStops.sort((a, b) => a.index - b.index)[0] ??
			tabStops.find((t) => t.index === 0);
        if (!firstTabStop) {
            const targetPos = editor.offsetToPos(baseOffset + text.length);
            editor.setCursor(targetPos);
            this.logger.debug("manager", 'Snippet has no tab stops; staying in normal mode.');
            return true;
        }

        const firstStopAbsolute: SnippetSessionStop = {
            index: firstTabStop.index,
            start: baseOffset + firstTabStop.start,
            end: baseOffset + firstTabStop.end,
        };
        this.focusStopByOffset(editor, firstStopAbsolute);
        this.pushSnippetSession(editor, baseOffset, tabStops, firstTabStop.index);

        this.logger.debug("manager", `✨ Expanded snippet: ${snippet.prefix} | Entered snippet mode`);
        return true;
    }

    applySnippetAtCursor(snippet: ParsedSnippet, editor?: Editor): boolean {
        const targetEditor = editor ?? getActiveEditor(this.app);
        if (!targetEditor) {
            new Notice('No active editor');
            return false;
        }

        const from = targetEditor.getCursor('from');
        const to = targetEditor.getCursor('to');

        return this.insertSnippet(targetEditor, snippet, from, to);
    }

	private getTextBeforeCursor(editor: Editor): { text: string; startOffset: number; endOffset: number } | null {
		const prefixInfo = this.snippetEngine.getPrefixInfo();
		return getContextBeforeCursor({
			editor,
			prefixInfo,
		});
	}

    private findSnippetMatch(editor: Editor): { snippet: ParsedSnippet; startOffset: number; endOffset: number } | null {
        const context = this.getTextBeforeCursor(editor);
        if (!context) {
            return null;
        }

        const snippet = this.snippetEngine.matchSnippetInContext(context.text);
        if (!snippet) {
            return null;
        }

        const startOffset = Math.max(0, context.endOffset - snippet.prefix.length);
        return {
            snippet,
            startOffset,
            endOffset: context.endOffset,
        };
    }

    getAvailableSnippets(): ParsedSnippet[] {
        return this.snippetEngine.getSnippets();
    }

    cycleChoiceAtCurrentStop(): boolean {
        const editor = getActiveEditor(this.app);
        if (!editor) return false;

        const session = this.getCurrentSession(editor);
        if (!session) return false;

        const stop = session.stops.find((s: SnippetSessionStop) => s.index === session.currentIndex);
        if (!stop || !stop.choices || stop.choices.length === 0) {
            return false;
        }

        const from = editor.offsetToPos(stop.start);
        const to = editor.offsetToPos(stop.end);
        const currentText = editor.getRange(from, to);
        const len = stop.choices.length;
        const currentIndex = stop.choices.findIndex(choice => choice === currentText);
        const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % len : 0;
        const nextValue = stop.choices[nextIndex] ?? '';

        editor.replaceRange(nextValue, from, to);

        const startOffset = editor.posToOffset(from);
        const newEndOffset = startOffset + nextValue.length;
        const newEndPos = editor.offsetToPos(newEndOffset);

        editor.setSelection(from, newEndPos);

        this.logger.debug("manager", `🔁 Cycled choice at tab stop $${stop.index}: "${nextValue}"`);

        return true;
    }

    private applyVariablesToText(
        text: string,
        tabStops: TabStopInfo[],
        variables: SnippetVariableInfo[] | undefined,
        editor: Editor
    ): { text: string; tabStops: TabStopInfo[] } {
        if (!variables || variables.length === 0) {
            return { text, tabStops };
        }

        let currentText = text;
        const updatedStops = tabStops.map((stop) => ({ ...stop }));
        const sortedVariables = [...variables].sort(
            (a, b) => a.start - b.start
        );

        let delta = 0;
        const missingVariables: string[] = [];
        for (const variable of sortedVariables) {
            const start = variable.start + delta;
            const end = variable.end + delta;
            const originalLength = end - start;

            const resolution = resolveVariableValue(variable.name, {
                app: this.app,
                editor,
            });

            let replacement =
                resolution.value ??
                variable.defaultValue ??
                "";

            if (resolution.value === null) {
                const reason = resolution.reason ?? "no data";
                this.logger.debug(
                    "manager",
                    `[Variable] ${variable.name} missing: ${reason}`
                );
                const fallbackInfo = variable.defaultValue
                    ? ` (fallback = "${variable.defaultValue}")`
                    : "";
                missingVariables.push(
                    `${variable.name}: ${reason}${fallbackInfo}`
                );
            }

            currentText =
                currentText.slice(0, start) +
                replacement +
                currentText.slice(end);

            const diff = replacement.length - originalLength;
			if (diff !== 0) {
				updatedStops.forEach((stop) => {
					const overlapsStart = stop.start >= start && stop.start <= end;
					const overlapsEnd = stop.end >= start && stop.end <= end;
					const wrapsVariable = stop.start < start && stop.end > end;
					const boundariesMatch = stop.end === start || stop.start === end;
					if (stop.start >= end) {
						stop.start += diff;
						stop.end += diff;
					} else if (overlapsStart || overlapsEnd || wrapsVariable || boundariesMatch) {
						stop.end += diff;
					}
				});
				delta += diff;
			}
        }

        if (missingVariables.length > 0) {
            const message =
                "Snippet variables missing:\n" +
                missingVariables.map((msg) => `• ${msg}`).join("\n");
            new Notice(message, 5000);
        }

        return { text: currentText, tabStops: updatedStops };
    }

    private focusStopByOffset(editor: Editor, stop: SnippetSessionStop): void {
        const anchor = editor.offsetToPos(stop.start);
        const head = editor.offsetToPos(stop.end);
        if (stop.start === stop.end) {
            editor.setCursor(anchor);
        } else {
            editor.setSelection(anchor, head);
        }
    }

    private getCurrentSession(editor: Editor): SnippetSessionEntry | null {
        const entries = this.getSessionEntries(editor);
        if (!entries || entries.length === 0) {
            return null;
        }
        return entries[entries.length - 1];
    }

    private popSnippetSession(editor: Editor): void {
        const view = getEditorView(editor);
        if (!view) return;
        view.dispatch({ effects: popSnippetSessionEffect.of(undefined) });
    }

    private isSelectionAtStop(editor: Editor, stop: SnippetSessionStop): boolean {
        const selectionFrom = editor.getCursor('from');
        const selectionTo = editor.getCursor('to');
        const cursor = editor.getCursor();
        const fromOffset = editor.posToOffset(selectionFrom);
        const toOffset = editor.posToOffset(selectionTo);
        const cursorOffset = editor.posToOffset(cursor);

        if (fromOffset === stop.start && toOffset === stop.end) {
            return true;
        }

        const isZeroLength = stop.start === stop.end;
        if (!isZeroLength) {
            return false;
        }
        const withinSelection =
            (fromOffset <= stop.start && toOffset >= stop.start) ||
            (fromOffset >= stop.start && fromOffset <= stop.end);
        const hit =
            cursorOffset === stop.start ||
            withinSelection;
        if (hit) {
            this.logger.debug(
                "manager",
                `[Jump] Zero-length stop already satisfied (cursor=${cursorOffset}, start=${stop.start})`
            );
        }
        return hit;
    }

    private getNextTabStopCandidate(
        session: SnippetSessionEntry,
        currentIndex: number
    ): { index: number; stop: SnippetSessionStop } | null {
        let nextIndex = currentIndex + 1;
        let nextStop = session.stops.find((t) => t.index === nextIndex);
        if (!nextStop && currentIndex !== 0) {
            nextIndex = 0;
            nextStop = session.stops.find((t) => t.index === 0);
        }
        if (!nextStop) {
            return null;
        }
        return { index: nextIndex, stop: nextStop };
    }

    private selectNextTabStop(session: SnippetSessionEntry): JumpCandidate | null {
        let nextTabIndex = session.currentIndex + 1;
        this.logger.debug("manager", `  Looking for $${nextTabIndex}...`);

        let nextTabStop = session.stops.find((t) => t.index === nextTabIndex);
        if (!nextTabStop && session.currentIndex !== 0) {
            this.logger.debug(
                "manager",
                `  No $${session.currentIndex + 1} found, looking for $0...`
            );
            nextTabIndex = 0;
            nextTabStop = session.stops.find((t) => t.index === 0);
        }

        if (!nextTabStop) {
            return null;
        }

        return { index: nextTabIndex, stop: nextTabStop };
    }

    private selectPrevTabStop(session: SnippetSessionEntry): JumpCandidate | null {
        const prevTabIndex = session.currentIndex - 1;
        const prevTabStop = session.stops.find((t) => t.index === prevTabIndex);
        if (!prevTabStop) {
            return null;
        }
        return { index: prevTabIndex, stop: prevTabStop };
    }

    private completeNextJumpTransition(
        editor: Editor,
        session: SnippetSessionEntry,
        candidate: JumpCandidate,
        options?: { silent?: boolean }
    ): boolean {
        this.focusStopByOffset(editor, candidate.stop);

        if (candidate.index === 0) {
            this.logger.debug("manager", `  Reached $0; exiting snippet mode`);
            return this.exitSnippetMode(editor, options);
        }

        const upcoming = this.getNextTabStopCandidate(session, candidate.index);
        if (this.shouldExitBeforeCachingNextStop(editor, upcoming)) {
            return this.exitSnippetMode(editor, options);
        }

        this.updateSnippetSessionIndex(editor, candidate.index);
        return true;
    }

    private completePrevJumpTransition(
        editor: Editor,
        _session: SnippetSessionEntry,
        candidate: JumpCandidate,
        options?: { silent?: boolean }
    ): boolean {
        this.focusStopByOffset(editor, candidate.stop);
        this.logger.debug("manager", `← Jump to tab stop $${candidate.index}`);

        if (candidate.index <= 0) {
            this.popSnippetSession(editor);
            if (this.isSnippetActive(editor)) {
                return this.jumpToPrevTabStop(options);
            }
            if (!options?.silent) new Notice('✅ No more tab stops');
            return false;
        }

        this.updateSnippetSessionIndex(editor, candidate.index);
        return true;
    }

    private getSelectionRange(editor: Editor): { from: number; to: number } {
        const selectionFrom = editor.getCursor("from");
        const selectionTo = editor.getCursor("to");
        return {
            from: editor.posToOffset(selectionFrom),
            to: editor.posToOffset(selectionTo),
        };
    }

    private shouldExitBeforeCachingNextStop(
        editor: Editor,
        candidate: { index: number; stop: SnippetSessionStop } | null
    ): boolean {
        if (!candidate) {
            this.logger.debug("manager", `  No upcoming tab stops; exiting snippet mode`);
            return true;
        }
        if (candidate.index !== 0) {
            return false;
        }
        const stop = candidate.stop;
        const isZeroLength = stop.start === stop.end;
        if (!isZeroLength) {
            return false;
        }
        const selection = this.getSelectionRange(editor);
        const isSelectionCollapsed = selection.from === selection.to;
        const hit = isSelectionCollapsed && selection.from === stop.start;
        if (hit) {
            this.logger.debug(
                "manager",
                `[Jump] Zero-length stop already satisfied (cursor=${selection.from}, start=${stop.start})`
            );
        }
        return hit;
    }

    private exitSnippetMode(editor: Editor, options?: { silent?: boolean }): boolean {
        this.popSnippetSession(editor);
        const stillActive = this.isSnippetActive(editor);
        if (stillActive) {
            return this.jumpToNextTabStop(options);
        }
        if (!options?.silent) {
            new Notice("✅ No more tab stops");
        }
        return false;
    }

}
