import { App, Editor, Notice } from "obsidian";
import type { EditorPosition } from "obsidian";
import type { EditorView } from "@codemirror/view";
import { Transaction } from "@codemirror/state";
import { SnippetEngine } from "./snippetEngine";
import { PluginLogger } from "./logger";
import { ParsedSnippet, TabStopInfo, SnippetVariableInfo, PluginSettings } from "./types";
import { processSnippetBody } from "./snippetBody";
import {
    pushSnippetSessionEffect,
    popSnippetSessionEffect,
    updateSnippetSessionEffect,
    replaceSnippetSessionEffect,
    clearSnippetSessionsEffect,
    snippetSessionField,
    SnippetSessionStop,
    SnippetSessionEntry,
    getSnippetSessionStack,
    setRealtimeSyncCallback,
} from './snippetSession';
import { getActiveEditor, getEditorView, findEditorByView } from "./utils/editorUtils";
import { resolveVariableValue } from "./variableResolver";
import { getContextBeforeCursor } from "./utils/prefixContext";
import {
	findStopByIndex,
	getCurrentStop,
	isReferenceStop,
	convertTabStopsToSessionStops,
	buildReferenceStopLinks,
} from "./utils/stopUtils";
import { adjustStopPositionsAfterReplacement, recalculateStopPositions, getSelectionOffsets, posToOffset, offsetToPos } from "./utils/positionUtils";
import { ReferenceSyncService } from "./utils/referenceSyncService";
import {
    JumpCandidate,
    TabStopJumpStrategySelector,
} from "./strategies/tabStopJumpStrategy";
import {
    TabStopPlaceholderStrategySelector,
} from "./strategies/tabStopPlaceholderStrategy";
import { getCursorContext } from "./utils/editorContext";
import { filterSnippetsByContext } from "./utils/snippetContext";

type SnippetManagerOptions = {
    onSnippetApplied?: (snippet: ParsedSnippet) => void;
    getSettings?: () => PluginSettings;
};

export class SnippetManager {
	private jumpStrategySelector: TabStopJumpStrategySelector;
	private placeholderStrategySelector: TabStopPlaceholderStrategySelector;
	private referenceSyncService: ReferenceSyncService;

	constructor(
		private app: App,
		private snippetEngine: SnippetEngine,
		private logger: PluginLogger,
		private options?: SnippetManagerOptions
	) {
		this.jumpStrategySelector = new TabStopJumpStrategySelector();
		this.placeholderStrategySelector = new TabStopPlaceholderStrategySelector();
		this.referenceSyncService = new ReferenceSyncService(logger);
		
		// Register realtime sync callback
		this.registerRealtimeSyncCallback();
	}

	/**
	 * Get active editor or show error and return null
	 * @param showError Whether to show error notice if editor is not available
	 * @returns Active editor or null if not available
	 */
	private requireActiveEditor(showError: boolean = true): Editor | null {
		const editor = getActiveEditor(this.app);
		if (!editor && showError) {
			new Notice('No active editor');
		}
		return editor;
	}

	/**
	 * Get editor view for an editor or return null
	 * @param editor The editor instance
	 * @returns EditorView or null if not available
	 */
	private requireEditorView(editor: Editor): EditorView | null {
		return getEditorView(editor);
	}
	
		private registerRealtimeSyncCallback(): void {
		setRealtimeSyncCallback((view, session, currentStop) => {
			const settings = this.options?.getSettings?.();
			if (!settings?.referenceSnippetEnabled || settings.referenceSyncMode !== 'realtime') {
				return;
			}
			
			// Find the editor that corresponds to this view
			const editor = findEditorByView(this.app, view);
			if (!editor) {
				this.logger.debug("manager", "⚠️ Could not find editor for view in realtime sync");
				return;
			}
			
			// Get the current session from view to ensure we have the latest state
			const currentStack = view.state.field(snippetSessionField);
			if (!currentStack || currentStack.length === 0) return;
			const latestSession = currentStack[currentStack.length - 1];
			
			// Use the currentStop passed from ViewPlugin, but ensure it matches the latest session
			// The currentStop positions have been mapped by CodeMirror, but end may be outdated
			// We'll use it as a reference but read actual text from document state
			if (currentStop && isReferenceStop(currentStop) && 
			    currentStop.index === latestSession.currentIndex) {
				// Sync reference stops using the currentStop from ViewPlugin (positions are mapped)
				const updatedStops = this.referenceSyncService.syncReferenceStops(editor, currentStop, latestSession, 'realtime');
				
				// If stops were updated, update the session with new positions
				if (updatedStops) {
					const updatedSession: SnippetSessionEntry = {
						...latestSession,
						stops: updatedStops,
					};
					view.dispatch({
						effects: replaceSnippetSessionEffect.of(updatedSession),
					});
					
					this.logger.debug("manager", `🔄 Realtime synced reference stops for $${currentStop.index}`);
				}
			}
		});
	}

    expandSnippet(): boolean {
        const editor = this.requireActiveEditor();
        if (!editor) {
            return false;
        }

        const match = this.findSnippetMatch(editor);
        if (!match) {
            return false;
        }

        const startPos = offsetToPos(editor, match.startOffset);
        const endPos = offsetToPos(editor, match.endOffset);

        return this.insertSnippet(editor, match.snippet, startPos, endPos);
    }

    jumpToNextTabStop(options?: { silent?: boolean }): boolean {
        const silent = options?.silent ?? false;
        const editor = this.requireActiveEditor(!silent);
        if (!editor) return false;

        const stack = this.getSessionStack(editor);
        if (!stack || stack.length === 0) {
            if (!silent) new Notice('⚠️ Not in snippet mode');
            return false;
        }

        const session = stack.at(-1)!;
        if (session.currentIndex === 0) {
            this.logger.debug("manager", `  Already at $0; exiting snippet mode`);
            return this.exitSnippetMode(editor, options);
        }
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
        const editor = this.requireActiveEditor(!silent);
        if (!editor) return false;

        const stack = this.getSessionStack(editor);
        if (!stack || stack.length === 0) {
            if (!silent) new Notice('⚠️ Not in snippet mode');
            return false;
        }

        const session = stack.at(-1)!;
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
            const editor = this.requireActiveEditor(false);
            if (editor) {
                targetView = this.requireEditorView(editor) ?? undefined;
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
		const view = this.requireEditorView(editor);
		if (!view) return;
		const stops = convertTabStopsToSessionStops(tabStops, baseOffset);

		// 为引用类型的 stops 建立 linkedStops 关系
		const referenceSummary = buildReferenceStopLinks(stops);
		if (referenceSummary) {
			this.logger.debug(
				"manager",
				`🔗 Reference tab stops detected: ${referenceSummary}`
			);
		}

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
        const view = this.requireEditorView(editor);
        if (!view) return;
        view.dispatch({ effects: updateSnippetSessionEffect.of({ currentIndex }) });
    }

    private getSessionStack(editor: Editor): SnippetSessionEntry[] | null {
        const view = this.requireEditorView(editor);
        if (!view) {
            return null;
        }
        return getSnippetSessionStack(view);
    }

    public isSnippetActive(editor: Editor): boolean {
        const stack = this.getSessionStack(editor);
        return !!stack && stack.length > 0;
    }

    private processSnippetBodyIfNeeded(snippet: ParsedSnippet): {
        text: string;
        tabStops: TabStopInfo[];
        variables: SnippetVariableInfo[] | undefined;
    } {
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
        
        return { text, tabStops, variables };
    }

    private handleSnippetWithoutTabStops(
        editor: Editor,
        snippet: ParsedSnippet,
        baseOffset: number,
        text: string,
        tabStops: TabStopInfo[]
    ): boolean {
        const zeroStop = tabStops.find((stop) => stop.index === 0);
        const targetOffset =
            zeroStop?.start !== undefined
                ? baseOffset + zeroStop.start
                : baseOffset + text.length;
        editor.setCursor(offsetToPos(editor, targetOffset));
        this.logger.debug(
            "manager",
            "Snippet expanded without tab stops; staying in normal mode."
        );
        this.notifySnippetApplied(snippet);
        return true;
    }

    private initializeTabStops(
        editor: Editor,
        snippet: ParsedSnippet,
        baseOffset: number,
        tabStops: TabStopInfo[]
    ): void {
        const positiveStops = tabStops.filter((t) => t.index > 0);
        const firstTabStop = positiveStops.sort((a, b) => a.index - b.index)[0];
        
        if (!firstTabStop) {
            return;
        }

        const firstStopAbsolute: SnippetSessionStop = {
            index: firstTabStop.index,
            start: baseOffset + firstTabStop.start,
            end: baseOffset + firstTabStop.end,
            choices: firstTabStop.choices,
            type: firstTabStop.type,
            referenceGroup: firstTabStop.referenceGroup,
        };
        
        this.focusStopByOffset(editor, firstStopAbsolute);
        this.pushSnippetSession(editor, baseOffset, tabStops, firstTabStop.index);
        
        // Call placeholder strategy initialization
        const placeholderStrategy = this.placeholderStrategySelector.getStrategy(firstStopAbsolute);
        placeholderStrategy.onStopInitialized?.(editor, firstStopAbsolute);
    }

    private insertSnippet(editor: Editor, snippet: ParsedSnippet, startPos: EditorPosition, endPos: EditorPosition): boolean {
        const { text: initialText, tabStops: initialTabStops, variables } = this.processSnippetBodyIfNeeded(snippet);

        const variableResult = this.applyVariablesToText(
            initialText,
            initialTabStops,
            variables,
            editor
        );
        const text = variableResult.text;
        const tabStops = variableResult.tabStops;

        editor.replaceRange(text, startPos, endPos);

        const baseOffset = posToOffset(editor, startPos);
        const positiveStops = tabStops.filter((t) => t.index > 0);
        const firstTabStop = positiveStops.sort((a, b) => a.index - b.index)[0];
        
        if (!firstTabStop) {
            return this.handleSnippetWithoutTabStops(editor, snippet, baseOffset, text, tabStops);
        }

        this.initializeTabStops(editor, snippet, baseOffset, tabStops);

        this.logger.debug("manager", `✨ Expanded snippet: ${snippet.prefix} | Entered snippet mode`);
        this.notifySnippetApplied(snippet);
        return true;
    }

    applySnippetAtCursor(snippet: ParsedSnippet, editor?: Editor): boolean {
        const targetEditor = editor ?? this.requireActiveEditor();
        if (!targetEditor) {
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

		const matches = this.snippetEngine.matchSnippets(context.text);
		if (matches.length === 0) {
			return null;
		}

		const cursorContext = getCursorContext(editor);
		const settings = this.options?.getSettings?.();
		const filtered = filterSnippetsByContext(
			matches,
			cursorContext,
			settings?.snippetFileConfigs
		);
		const snippet = filtered[0];
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

	private notifySnippetApplied(snippet: ParsedSnippet): void {
		this.options?.onSnippetApplied?.(snippet);
	}

	cycleChoiceAtCurrentStop(): boolean {
		const editor = this.requireActiveEditor(false);
        if (!editor) return false;

        const session = this.getCurrentSession(editor);
        if (!session) return false;

        const stop = getCurrentStop(session);
        if (!stop) {
            return false;
        }

        const strategy = this.placeholderStrategySelector.getStrategy(stop);
        const actions = strategy.getSpecialActions?.(stop);
        
        if (!actions || !actions.includes('cycleChoice')) {
            return false;
        }

        // Get current text before cycling
        const from = offsetToPos(editor, stop.start);
        const to = offsetToPos(editor, stop.end);
        const oldText = editor.getRange(from, to);

        const result = strategy.executeSpecialAction?.(editor, stop, 'cycleChoice');
        
        if (result) {
            // Get new text after cycling
            const newFrom = offsetToPos(editor, stop.start);
            const newTo = offsetToPos(editor, stop.end);
            const newText = editor.getRange(newFrom, newTo);
            this.logger.debug("manager", `🔁 Cycled choice at tab stop $${stop.index}: "${oldText}" -> "${newText}"`);
        }

        return result ?? false;
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
				const adjustedStops = adjustStopPositionsAfterReplacement(
					updatedStops,
					start,
					end,
					replacement.length
				);
				// Update the array in place
				adjustedStops.forEach((adjustedStop, idx) => {
					updatedStops[idx] = adjustedStop;
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
        const anchor = offsetToPos(editor, stop.start);
        const head = offsetToPos(editor, stop.end);
        if (stop.start === stop.end) {
            editor.setCursor(anchor);
        } else {
            editor.setSelection(anchor, head);
        }
    }

    private getCurrentSession(editor: Editor): SnippetSessionEntry | null {
        const stack = this.getSessionStack(editor);
        return stack && stack.length > 0 ? stack[stack.length - 1] : null;
    }

    private popSnippetSession(editor: Editor): void {
        const view = this.requireEditorView(editor);
        if (!view) return;
        view.dispatch({ effects: popSnippetSessionEffect.of(undefined) });
    }


    private selectNextTabStop(session: SnippetSessionEntry): JumpCandidate | null {
        const currentStop = getCurrentStop(session);
        if (!currentStop) {
            return null;
        }

        this.logger.debug("manager", `  Looking for $${session.currentIndex + 1}...`);

        const candidate = this.selectTabStopWithStrategy(session, currentStop, 'next');

        if (!candidate && session.currentIndex !== 0) {
            this.logger.debug(
                "manager",
                `  No $${session.currentIndex + 1} found, looking for $0...`
            );
        }

        return candidate;
    }

    private selectPrevTabStop(session: SnippetSessionEntry): JumpCandidate | null {
        const currentStop = getCurrentStop(session);
        if (!currentStop) {
            return null;
        }

        return this.selectTabStopWithStrategy(session, currentStop, 'prev');
    }

    private selectTabStopWithStrategy(
        session: SnippetSessionEntry,
        currentStop: SnippetSessionStop,
        direction: 'next' | 'prev'
    ): JumpCandidate | null {
        const settings = this.options?.getSettings?.();
        const strategy = this.jumpStrategySelector.getStrategy(currentStop, settings);
        return direction === 'next'
            ? strategy.selectNext(session, session.currentIndex)
            : strategy.selectPrev(session, session.currentIndex);
    }

    private shouldSyncBeforeJump(
        previousStop: SnippetSessionStop | undefined,
        settings: PluginSettings | undefined
    ): boolean {
        return !!(
            previousStop &&
            isReferenceStop(previousStop) &&
            settings?.referenceSnippetEnabled &&
            settings.referenceSyncMode === 'on-jump'
        );
    }

    private syncAndUpdateSession(
        editor: Editor,
        previousStop: SnippetSessionStop,
        session: SnippetSessionEntry
    ): SnippetSessionEntry {
        const view = this.requireEditorView(editor);
        if (!view) return session;

        const updatedStops = this.referenceSyncService.syncReferenceStops(
            editor,
            previousStop,
            session,
            'on-jump'
        );

        if (updatedStops) {
            const updatedSession: SnippetSessionEntry = {
                ...session,
                stops: updatedStops,
            };
            view.dispatch({
                effects: replaceSnippetSessionEffect.of(updatedSession),
            });
            return updatedSession;
        }

        return session;
    }

    private updateCandidateWithSyncedStops(
        candidate: JumpCandidate,
        session: SnippetSessionEntry
    ): JumpCandidate {
        const updatedStop = session.stops.find(
            (stop) => stop.index === candidate.index
        );
        return updatedStop
            ? { index: candidate.index, stop: updatedStop }
            : candidate;
    }

    private shouldExitAfterJump(
        editor: Editor,
        candidate: JumpCandidate,
        session: SnippetSessionEntry,
        previousStop: SnippetSessionStop | undefined
    ): boolean {
        const candidateStop = findStopByIndex(session, candidate.index);
        const upcoming = candidateStop
            ? this.selectTabStopWithStrategy(session, candidateStop, 'next')
            : null;

        return candidate.index === 0
            ? this.shouldExitBeforeCachingNextStop(editor, candidate, previousStop)
            : this.shouldExitBeforeCachingNextStop(editor, upcoming, previousStop);
    }

    private completeNextJumpTransition(
        editor: Editor,
        session: SnippetSessionEntry,
        candidate: JumpCandidate,
        options?: { silent?: boolean }
    ): boolean {
        const previousStop = getCurrentStop(session);
        const settings = this.options?.getSettings?.();

        // Sync reference stops before jumping (if on-jump mode)
        let finalSession = session;
        if (this.shouldSyncBeforeJump(previousStop, settings)) {
            finalSession = this.syncAndUpdateSession(editor, previousStop!, session);
            candidate = this.updateCandidateWithSyncedStops(candidate, finalSession);
        }

        // Check if we should exit before jumping
        if (this.shouldExitAfterJump(editor, candidate, finalSession, previousStop)) {
            return this.exitSnippetMode(editor, options);
        }

        // Handle exit case at $0
        if (candidate.index === 0) {
            this.focusStopByOffset(editor, candidate.stop);
            this.updateSnippetSessionIndex(editor, candidate.index);
            this.logger.debug("manager", `  Reached $0; exiting snippet mode`);
            return this.exitSnippetMode(editor, options);
        }

        // Perform the jump
        this.focusStopByOffset(editor, candidate.stop);
        this.updateSnippetSessionIndex(editor, candidate.index);

        // Call placeholder strategy focus handler
        const placeholderStrategy = this.placeholderStrategySelector.getStrategy(candidate.stop);
        placeholderStrategy.onStopFocused?.(editor, candidate.stop);

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
        
        // Call placeholder strategy focus handler
        const placeholderStrategy = this.placeholderStrategySelector.getStrategy(candidate.stop);
        placeholderStrategy.onStopFocused?.(editor, candidate.stop);

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
        return getSelectionOffsets(editor);
    }

    private shouldExitBeforeCachingNextStop(
        editor: Editor,
        candidate: JumpCandidate | null,
        currentStop?: SnippetSessionStop
    ): boolean {
        if (!candidate) {
            this.logger.debug("manager", `  No upcoming tab stops; exiting snippet mode`);
            return true;
        }
        if (candidate.index !== 0) {
            return false;
        }
        const stop = candidate.stop;
        const selection = this.getSelectionRange(editor);
        const hasSelection = selection.from !== selection.to;
        const isZeroLength = stop.start === stop.end;
        if (isZeroLength && selection.from === selection.to && selection.from >= stop.start) {
            return true;
        }
        const overlapsSelection =
            hasSelection &&
            stop.start >= selection.from &&
            stop.start <= selection.to;
        if (overlapsSelection) {
            this.logger.debug(
                "manager",
                `[Jump] Zero-length stop overlaps selection (${selection.from}-${selection.to}); exiting snippet mode`
            );
            return true;
        }
        if (
            currentStop &&
            currentStop.index !== 0 &&
            stop.start <= currentStop.end
        ) {
            this.logger.debug(
                "manager",
                `[Jump] $0 overlaps $${currentStop.index}; exiting snippet mode`
            );
            return true;
        }
        return false;
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
