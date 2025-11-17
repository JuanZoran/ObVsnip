import { App, Editor, MarkdownView, Notice } from 'obsidian';
import type { EditorView } from '@codemirror/view';
import { SnippetEngine } from './snippetEngine';
import { PluginLogger } from './logger';
import { ParsedSnippet, TabStopInfo } from './types';
import { processSnippetBody } from './snippetBody';
import {
    pushSnippetSessionEffect,
    popSnippetSessionEffect,
    updateSnippetSessionEffect,
    clearSnippetSessionsEffect,
    snippetSessionField,
    SnippetSessionStop,
    SnippetSessionEntry,
} from './snippetSession';
import { getEditorView } from './editorUtils';

export class SnippetManager {
    constructor(private app: App, private snippetEngine: SnippetEngine, private logger: PluginLogger) {}

    expandSnippet(): boolean {
        const editor = this.getActiveEditor();
        if (!editor) {
            new Notice('No active editor');
            return false;
        }

        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);

        const snippet = this.snippetEngine.matchSnippetAtCursor(line, cursor.ch);
        if (!snippet) {
            return false;
        }

        const prefixInfo = this.snippetEngine.extractMatchedPrefix(line, cursor.ch, snippet.prefix);

        return this.insertSnippet(editor, snippet, cursor.line, prefixInfo.start, prefixInfo.end);
    }

    jumpToNextTabStop(options?: { silent?: boolean }): boolean {
        const silent = options?.silent ?? false;
        const editor = this.getActiveEditor();
        if (!editor) return false;

        const session = this.getCurrentSession(editor);
        if (!session) {
            if (!silent) new Notice('⚠️ Not in snippet mode');
            return false;
        }

        this.logger.debug(`\n⏭️  JUMP from $${session.currentIndex}:`);

        let nextTabIndex = session.currentIndex + 1;
        let nextTabStop = session.stops.find((t: SnippetSessionStop) => t.index === nextTabIndex);

        this.logger.debug(`  Looking for $${nextTabIndex}...`);

        if (!nextTabStop && session.currentIndex !== 0) {
            nextTabIndex = 0;
            nextTabStop = session.stops.find((t: SnippetSessionStop) => t.index === 0);
            this.logger.debug(`  No $${session.currentIndex + 1} found, looking for $0...`);
        }

        if (!nextTabStop) {
            this.logger.debug(`  ❌ No more tab stops, exiting snippet mode`);
            this.forceExitSnippetMode(getEditorView(editor) ?? undefined);
            if (!silent) new Notice('✅ No more tab stops');
            return false;
        }

        this.focusStopByOffset(editor, nextTabStop);

        if (nextTabIndex === 0) {
        this.logger.debug(`  Special case: Stop is $0. Exiting.`);
            const view = getEditorView(editor);
            this.popSnippetSession(editor);
            const stillActive = view ? view.state.field(snippetSessionField).length > 0 : false;
            if (stillActive) {
                return this.jumpToNextTabStop(options);
            }
            if (!silent) new Notice('✅ No more tab stops');
            return false;
        }

        this.updateSnippetSessionIndex(editor, nextTabIndex);
        return true;
    }

    jumpToPrevTabStop(): void {
        const editor = this.getActiveEditor();
        if (!editor) return;

        const session = this.getCurrentSession(editor);
        if (!session) {
            new Notice('⚠️ Not in snippet mode');
            return;
        }

        const prevTabIndex = session.currentIndex - 1;
        const prevTabStop = session.stops.find((t: SnippetSessionStop) => t.index === prevTabIndex);

        if (prevTabStop && prevTabIndex > 0) {
            this.focusStopByOffset(editor, prevTabStop);
            this.logger.debug(`← Jump to tab stop $${prevTabIndex}`);
            this.updateSnippetSessionIndex(editor, prevTabIndex);
        } else {
            new Notice('⏮️ No previous tab stops');
        }
    }

    forceExitSnippetMode(view?: EditorView): boolean {
        let targetView: EditorView | undefined = view;
        if (!targetView) {
            const editor = this.getActiveEditor();
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
        this.logger.debug('🔴 Exited snippet mode via force exit');
        return true;
    }

	private pushSnippetSession(editor: Editor, baseOffset: number, tabStops: TabStopInfo[], initialIndex: number): void {
		const view = getEditorView(editor);
		if (!view) return;
		const stops: SnippetSessionStop[] = tabStops.map(stop => ({
			index: stop.index,
			start: baseOffset + stop.start,
			end: baseOffset + stop.end,
		}));
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
        const view = getEditorView(editor);
        if (!view) return null;
        return view.state.field(snippetSessionField);
    }

    private insertSnippet(editor: Editor, snippet: ParsedSnippet, line: number, startCh: number, endCh: number): boolean {
        let text = snippet.processedText;
        let tabStops = snippet.tabStops;
        if (!text || !tabStops || tabStops.length === 0) {
            const processed = processSnippetBody(snippet.body, this.logger);
            text = processed.text;
            tabStops = processed.tabStops;
        }

        editor.replaceRange(text, { line, ch: startCh }, { line, ch: endCh });

        const baseOffset = editor.posToOffset({ line, ch: startCh });
        const firstTabStop = tabStops.find(t => t.index === 1) || tabStops.find(t => t.index === 0);
        if (!firstTabStop) {
            editor.setCursor({ line, ch: startCh + text.length });
            this.logger.debug('Snippet has no tab stops; staying in normal mode.');
            return true;
        }

        const firstStopAbsolute: SnippetSessionStop = {
            index: firstTabStop.index,
            start: baseOffset + firstTabStop.start,
            end: baseOffset + firstTabStop.end,
        };
        this.focusStopByOffset(editor, firstStopAbsolute);
        this.pushSnippetSession(editor, baseOffset, tabStops, firstTabStop.index);

        this.logger.debug(`✨ Expanded snippet: ${snippet.prefix} | Entered snippet mode`);
        return true;
    }

    applySnippetAtCursor(snippet: ParsedSnippet, editor?: Editor): boolean {
        const targetEditor = editor ?? this.getActiveEditor();
        if (!targetEditor) {
            new Notice('No active editor');
            return false;
        }

        const from = targetEditor.getCursor('from');
        const to = targetEditor.getCursor('to');

        return this.insertSnippet(targetEditor, snippet, from.line, Math.min(from.ch, to.ch), Math.max(from.ch, to.ch));
    }

    getAvailableSnippets(): ParsedSnippet[] {
        return this.snippetEngine.getSnippets();
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

    getActiveEditor(): Editor | null {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        return view?.editor || null;
    }
}
