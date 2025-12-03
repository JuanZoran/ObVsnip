import { App, Editor, type EditorPosition } from "obsidian";
import { rankSnippets } from "./snippetRankingPipeline";

import type {
	ParsedSnippet,
	PrefixInfo,
	RankingAlgorithmId,
	RankingAlgorithmSetting,
	SnippetMenuKeymap,
	SnippetFileConfig,
	PluginSettings,
} from "./types";

import { SnippetManager } from "./snippetManager";

import { PluginLogger } from "./logger";

import { getActiveEditor, getCursorCoords } from "./utils/editorUtils";
import { getContextBeforeCursor } from "./utils/prefixContext";
import { offsetToPos, posToOffset } from "./utils/positionUtils";
import { getMonotonicTime } from "./telemetry";
import { getSnippetWidgetConfig } from "./snippetSession";
import { applySnippetStyles } from "./utils/styleUtils";
import { renderChoiceList } from "./utils/choiceUtils";
import { getCursorContext } from "./utils/editorContext";
import { filterSnippetsByContext } from "./utils/snippetContext";

interface SnippetMenuOptions {
	getSnippets: () => ParsedSnippet[];

	manager: SnippetManager;

	logger: PluginLogger;

	getRankingAlgorithms: () => RankingAlgorithmSetting[];
	getUsageCounts?: () => Map<string, number>;
	getPrefixInfo?: () => PrefixInfo;
	getRankingAlgorithmNames: () => Record<RankingAlgorithmId, string>;
	getSources?: () => string[];
	getCurrentSource?: () => string;
	setCurrentSource?: (source: string) => void;
	getMenuKeymap?: () => SnippetMenuKeymap;
	getSnippetFileConfigs?: () => Record<string, SnippetFileConfig>;
	getSettings?: () => PluginSettings;
}

const matchesFuzzy = (source: string, query: string): boolean => {
	if (!query) return false;
	let position = 0;
	for (const char of query) {
		position = source.indexOf(char, position);
		if (position < 0) return false;
		position += 1;
	}
	return true;
};

export const formatSnippetPreview = (snippet: ParsedSnippet): DocumentFragment => {
	const fragment = document.createDocumentFragment();
	const text = snippet.processedText ?? snippet.body ?? "";
	const stops = Array.isArray(snippet.tabStops)
		? [...snippet.tabStops].sort((a, b) => a.start - b.start)
		: [];
	let cursor = 0;

	for (const stop of stops) {
		if (stop.start < cursor) {
			continue;
		}
		if (stop.start > cursor) {
			fragment.appendChild(document.createTextNode(text.slice(cursor, stop.start)));
		}

		const placeholderSpan = document.createElement("span");
		placeholderSpan.className = "preview-placeholder";
		const placeholderText =
			text.slice(stop.start, stop.end) || stop.choices?.[0] || `$${stop.index}`;
		placeholderSpan.textContent = placeholderText;
		fragment.appendChild(placeholderSpan);

		if (stop.choices && stop.choices.length > 0) {
			const choiceContainer = document.createElement("span");
			choiceContainer.className = "preview-choice-list";
			renderChoiceList(choiceContainer, stop.choices, {
				activeIndex: 0,
			});
			fragment.appendChild(choiceContainer);
		}

		cursor = Math.max(cursor, stop.end);
	}

	const trailing = text.slice(cursor);
	if (trailing) {
		const ghostText = document.createElement("span");
		ghostText.className = "preview-ghost-text";
		ghostText.textContent = trailing;
		fragment.appendChild(ghostText);
	}

	return fragment;
};

const applyPreviewStyles = (el: HTMLElement): void => {
	const config = getSnippetWidgetConfig();
	applySnippetStyles(el, config);
};

export class SnippetCompletionMenu {
	private container: HTMLElement | null = null;

	private listEl: HTMLElement | null = null;

	private previewTitleEl: HTMLElement | null = null;

	private previewDescEl: HTMLElement | null = null;

	private previewBodyEl: HTMLElement | null = null;

	private previewStopsEl: HTMLElement | null = null;
	private previewMatchEl: HTMLElement | null = null;

	private entries: ParsedSnippet[] = [];

	private activeIndex = 0;

	private boundKeydown: (event: KeyboardEvent) => void;

	private boundClick: (event: MouseEvent) => void;

	private currentEditor: Editor | null = null;

	private currentQuery = "";

	private emptyStateMessage: string | null = null;

	private anchorCoords: { top: number; left: number } | null = null;

	private initialSelection: {
		from: EditorPosition;
		to: EditorPosition;
	} | null = null;

	private hadInitialSelection = false;

	private mouseMovedSinceOpen = false;

	private boundReposition: () => void;

	private boundPointerMove: () => void;

	private queryAnchorPos: EditorPosition | null = null;
	private snippetMatchFields: Map<ParsedSnippet, string> = new Map();
	private sourceLabelEl: HTMLElement | null = null;

	constructor(private app: App, private options: SnippetMenuOptions) {
		this.boundKeydown = this.handleKeydown.bind(this);

		this.boundClick = this.handleClickOutside.bind(this);
		this.boundReposition = this.handleReposition.bind(this);
		this.boundPointerMove = this.handlePointerMove.bind(this);
	}

	open(editor?: Editor | null, initialQuery = ""): boolean {
		const targetEditor = editor ?? getActiveEditor(this.app);

		if (!targetEditor) {
			this.options.logger.debug(
				"menu",
				"[SnippetMenu] open: no active editor"
			);

			return false;
		}

		this.close();

		this.currentEditor = targetEditor;
		this.captureInitialSelection(targetEditor);
		this.mouseMovedSinceOpen = false;

		const queryContext = this.getQueryContext(
			targetEditor,
			initialQuery
		);
		this.currentQuery = queryContext.text;
		this.queryAnchorPos = queryContext.range.from;

		const hasEntries = this.updateEntriesForQuery(this.currentQuery);

		if (!hasEntries) {
			this.options.logger.debug(
				"menu",
				"[SnippetMenu] open: no snippets match query"
			);

			return false;
		}

		const coords = getCursorCoords(targetEditor);
		this.anchorCoords = coords;

		this.render(coords);

		this.selectIndex(0);

		window.addEventListener("keydown", this.boundKeydown, true);

		window.addEventListener("mousedown", this.boundClick, true);
		window.addEventListener("scroll", this.boundReposition, true);
		window.addEventListener("resize", this.boundReposition, true);
		window.addEventListener("pointermove", this.boundPointerMove, true);

		return true;
	}

	close(): void {
		if (this.container?.parentElement) {
			this.container.remove();
		}

		this.container = null;

		window.removeEventListener("keydown", this.boundKeydown, true);

		window.removeEventListener("mousedown", this.boundClick, true);
		window.removeEventListener("scroll", this.boundReposition, true);
		window.removeEventListener("resize", this.boundReposition, true);
		window.removeEventListener("pointermove", this.boundPointerMove, true);

		this.currentEditor = null;
		this.anchorCoords = null;
		this.initialSelection = null;
		this.hadInitialSelection = false;
		this.mouseMovedSinceOpen = false;
		this.queryAnchorPos = null;
	}

	isOpen(): boolean {
		return !!this.container;
	}

	toggle(editor?: Editor | null, initialQuery = ""): boolean {
		if (this.isOpen()) {
			this.close();

			return true;
		}

		return this.open(editor, initialQuery);
	}

	navigate(delta: number): boolean {
		if (!this.isOpen()) return false;

		this.selectIndex(this.activeIndex + delta);

		return true;
	}

	private navigateSource(delta: number): void {
		const sources = this.getSourceList();
		if (!sources || sources.length <= 1) return;
		const current = this.getCurrentSource();
		const currentIndex = Math.max(0, sources.indexOf(current));
		const nextIndex = (currentIndex + delta + sources.length) % sources.length;
		const nextSource = sources[nextIndex];
		this.options.setCurrentSource?.(nextSource);
		this.updateSourceLabel();
		this.refreshEntriesForSourceChange();
	}

	acceptCurrent(): boolean {
		if (!this.isOpen()) return false;

		this.applySelection(this.activeIndex);

		return true;
	}

	private getVisibleSnippets(): ParsedSnippet[] {
		const snippets = this.options.getSnippets().filter((snippet) => !snippet.hide);
		const sourceFiltered = this.filterBySource(snippets);
		const contextFiltered = this.filterByContext(sourceFiltered);

		// 如果当前来源在上下文下无可用条目，自动回退到 all 以避免空菜单
		if (contextFiltered.length === 0 && this.getCurrentSource() !== "all") {
			this.options.setCurrentSource?.("all");
			this.updateSourceLabel();
			const fallbackFiltered = this.filterByContext(this.filterBySource(snippets));
			return fallbackFiltered;
		}

		return contextFiltered;
	}

	private getSourceList(): string[] {
		return this.options.getSources?.() ?? ["all"];
	}

	private getCurrentSource(): string {
		return this.options.getCurrentSource?.() ?? "all";
	}

	private getSourceLabel(source: string): string {
		if (source === "all") return "All";
		const parts = source.split("/");
		return parts[parts.length - 1] || source;
	}

	private getCurrentSourceLabel(): string {
		return this.getSourceLabel(this.getCurrentSource());
	}

	private filterBySource(snippets: ParsedSnippet[]): ParsedSnippet[] {
		const source = this.getCurrentSource();
		if (source === "all") return snippets;
		return snippets.filter((snippet) => snippet.source === source);
	}

	private filterByContext(snippets: ParsedSnippet[]): ParsedSnippet[] {
		const editor = this.currentEditor ?? getActiveEditor(this.app);
		if (!editor) return snippets;
		const ctx = getCursorContext(editor);
		const configs = this.options.getSnippetFileConfigs?.();
		return filterSnippetsByContext(snippets, ctx, configs);
	}

	/**
	 * Check if a snippet matches a query candidate
	 */
	private matchSnippet(snippet: ParsedSnippet, candidate: string): boolean {
		const prefixLower = snippet.prefix.toLowerCase();
		const descLower = snippet.description?.toLowerCase();

		return (
			prefixLower.startsWith(candidate) ||
			matchesFuzzy(prefixLower, candidate) ||
			(descLower?.includes(candidate) ?? false)
		);
	}

	private filterSnippets(
		query: string,
		candidates?: ParsedSnippet[]
	): {
		snippets: ParsedSnippet[];
		matchFields: Map<ParsedSnippet, string>;
		bestCandidate: string | undefined;
	} {
		const normalized = query.trim().toLowerCase();
		const snippets = candidates ?? this.getVisibleSnippets();

		if (!normalized) {
			return {
				snippets,
				matchFields: new Map(),
				bestCandidate: undefined,
			};
		}

		const suffixes = this.buildSuffixCandidates(normalized);
		const matchInfo = new Map<ParsedSnippet, { length: number; value: string }>();
		let hasAnyMatchOverall = false;

		// Try each suffix candidate from longest to shortest
		for (const candidate of suffixes) {
			let matchedAny = false;

			for (const snippet of snippets) {
				if (!this.matchSnippet(snippet, candidate)) continue;

				matchedAny = true;
				hasAnyMatchOverall = true;
				const previous = matchInfo.get(snippet);
				// Keep the longest matching candidate
				if (!previous || candidate.length > previous.length) {
					matchInfo.set(snippet, { length: candidate.length, value: candidate });
				}
			}

			// Early exit only if no matches found and we haven't found any matches yet
			if (!matchedAny && !hasAnyMatchOverall) {
				break;
			}
		}

		// Build results
		const acceptedSnippets = Array.from(matchInfo.keys());
		const matchFields = new Map<ParsedSnippet, string>();
		for (const [snippet, info] of matchInfo.entries()) {
			matchFields.set(snippet, info.value);
		}

		// Find the best candidate (longest match)
		const bestCandidate = Array.from(matchInfo.values())
			.sort((a, b) => b.length - a.length)[0]?.value;

		return {
			snippets: acceptedSnippets,
			matchFields,
			bestCandidate,
		};
	}

	private buildSuffixCandidates(value: string): string[] {
		const candidates: string[] = [];
		for (let len = 1; len <= value.length; len++) {
			const candidate = value.substring(value.length - len);
			if (!candidate) continue;
			candidates.push(candidate);
		}
		return candidates;
	}

	private render(coords: { top: number; left: number }): void {
		const container = document.createElement("div");

		container.className = "snippet-completion-menu";

		container.style.top = `${coords.top}px`;

		container.style.left = `${coords.left}px`;

		const listWrapper = container.createDiv({
			cls: "snippet-completion-list",
		});

		this.listEl = listWrapper;
		this.populateList(listWrapper);

		const preview = container.createDiv({
			cls: "snippet-completion-preview",
		});

		this.previewTitleEl = preview.createDiv({
			cls: "snippet-preview-title",
		});

		this.previewDescEl = preview.createDiv({ cls: "snippet-preview-desc" });

		this.previewStopsEl = preview.createDiv({
			cls: "snippet-preview-stops",
		});

		this.previewBodyEl = preview.createEl("pre", {
			cls: "snippet-preview-body",
		});
		this.previewMatchEl = preview.createDiv({
			cls: "snippet-preview-match",
		});

		document.body.appendChild(container);

		this.container = container;
		this.positionContainer(coords);
	}

	private selectIndex(
		index: number,
		options?: { preventScroll?: boolean }
	): void {
		if (!this.listEl || this.entries.length === 0) return;

		if (index < 0) index = this.entries.length - 1;

		if (index >= this.entries.length) index = 0;

		this.activeIndex = index;

		const items = Array.from(
			this.listEl.querySelectorAll<HTMLElement>(
				".snippet-completion-item"
			)
		);

		items.forEach((item, idx) =>
			item.toggleClass("is-selected", idx === index)
		);

		this.updatePreview(this.entries[index]);

		const activeItem = items[index];

		if (activeItem && !options?.preventScroll) {
			activeItem.scrollIntoView({ block: "nearest" });
		}
	}

	private updatePreview(snippet: ParsedSnippet): void {
		if (!this.previewTitleEl || !this.previewDescEl || !this.previewBodyEl)
			return;

		this.previewTitleEl.textContent = snippet.prefix;

		this.previewDescEl.textContent = snippet.description ?? "";

		this.previewDescEl.toggleClass("is-hidden", !snippet.description);

		const fragment = formatSnippetPreview(snippet);
		this.previewBodyEl.textContent = "";
		this.previewBodyEl.appendChild(fragment);
		applyPreviewStyles(this.previewBodyEl);

		if (this.previewStopsEl) {
			const stops = (snippet.tabStops ?? []).map((stop) => `$${stop.index}`);
			this.previewStopsEl.textContent =
				stops.length > 0 ? `Tab stops: ${stops.join(", ")}` : "";
			this.previewStopsEl.toggleClass("is-hidden", stops.length === 0);
		}

		if (this.previewMatchEl) {
			const matchField = this.getMatchField(snippet);
			this.previewMatchEl.textContent = matchField
				? `当前匹配字段: ${matchField}`
				: "";
			this.previewMatchEl.toggleClass("is-hidden", !matchField);
		}
	}

	private handleKeydown(event: KeyboardEvent): void {
		if (!this.container || !this.currentEditor) return;

		if (this.handleSourceKey(event)) {
			return;
		}

		switch (event.key) {
			case "ArrowDown":
				event.preventDefault();

				this.selectIndex(this.activeIndex + 1);

				break;

			case "ArrowUp":
				event.preventDefault();

				this.selectIndex(this.activeIndex - 1);

				break;

			case "Enter":
				event.preventDefault();

				this.applySelection(this.activeIndex);

				break;

			case "Escape":
				event.preventDefault();

				this.close();

				break;

			default:
				requestAnimationFrame(() => this.refreshEntries());
		}
	}

	private handleSourceKey(event: KeyboardEvent): boolean {
		const keymap = this.options.getMenuKeymap?.();
		if (this.matchesBinding(event, keymap?.sourceNext, "n")) {
			event.preventDefault();
			this.navigateSource(1);
			return true;
		}
		if (this.matchesBinding(event, keymap?.sourcePrev, "p")) {
			event.preventDefault();
			this.navigateSource(-1);
			return true;
		}
		return false;
	}

	private handleClickOutside(event: MouseEvent): void {
		if (!this.container) return;

		if (!event.target) return;

		if (!this.container.contains(event.target as Node)) {
			this.close();
		}
	}

	private refreshEntries(): void {
		if (!this.currentEditor) return;

		const context = this.getQueryContext(this.currentEditor);
		const newQuery = context.text;
		if (newQuery === this.currentQuery) return;
		this.currentQuery = newQuery;
		this.queryAnchorPos = context.range.from;

		const hasEntries = this.updateEntriesForQuery(this.currentQuery);

		const range = context.range;
		this.options.logger.debug(
			"menu",
			`[Telemetry] refresh triggered query="${this.currentQuery}" range=${range.from.line}:${range.from.ch}-${range.to.line}:${range.to.ch} hasEntries=${hasEntries}`
		);

		if (!hasEntries) {
			this.close();

			return;
		}

		if (!this.listEl || !this.container) return;

			this.populateList(this.listEl);

			this.selectIndex(0);
		}

	private refreshEntriesForSourceChange(): void {
		if (!this.listEl) return;
		const hasEntries = this.updateEntriesForQuery(this.currentQuery);
		this.populateList(this.listEl);
		if (this.entries.length > 0) {
			const targetIndex = Math.min(this.activeIndex, this.entries.length - 1);
			this.selectIndex(Math.max(0, targetIndex));
		} else if (!hasEntries) {
			this.close();
		}
	}

	private applySelection(index: number): void {
		const snippet = this.entries[index];

		if (!snippet || !this.currentEditor) {
			return;
		}

		const replacementRange = this.getReplacementRange(
			snippet,
			this.currentEditor
		);

		this.currentEditor.setSelection(
			replacementRange.from,
			replacementRange.to
		);

		this.options.logger.debug(
			"menu",
			`[SnippetMenu] Applying snippet ${snippet.prefix}`
		);

		this.options.manager.applySnippetAtCursor(snippet, this.currentEditor);

		this.close();
	}


	private resolveQueryContext(
		editor: Editor
	): {
		text: string;
		range: { from: EditorPosition; to: EditorPosition };
		windowLimited: boolean;
	} | null {
		const prefixInfo = this.options.getPrefixInfo?.();
		if (!prefixInfo?.maxLength) return null;
		
		const context = getContextBeforeCursor({
			editor,
			prefixInfo,
		});
		if (!context) return null;
		
		const cursor = editor.getCursor();
		let from = offsetToPos(editor, context.startOffset);
		const span = context.endOffset - context.startOffset;
		const windowLimited =
			span >= prefixInfo.maxLength && prefixInfo.maxLength > 0;
		
		if (!windowLimited) {
			return {
				text: context.text,
				range: { from, to: cursor },
				windowLimited: false,
			};
		}

		return this.resolveWindowLimitedContext(editor, cursor, from, context.text);
	}

	private resolveWindowLimitedContext(
		editor: Editor,
		cursor: EditorPosition,
		from: EditorPosition,
		initialText: string
	): {
		text: string;
		range: { from: EditorPosition; to: EditorPosition };
		windowLimited: boolean;
	} {
		if (from.line === cursor.line) {
			const line = editor.getLine(cursor.line) ?? "";
			const expandedStart = this.expandQueryStart(line, from.ch);
			if (expandedStart !== from.ch) {
				return {
					text: line.slice(expandedStart, cursor.ch),
					range: {
						from: { line: cursor.line, ch: expandedStart },
						to: cursor,
					},
					windowLimited: true,
				};
			}
		}

		return {
			text: initialText,
			range: { from, to: cursor },
			windowLimited: true,
		};
	}

	private buildRegexQueryContext(
		editor: Editor
	): { text: string; range: { from: EditorPosition; to: EditorPosition } } {
		const cursor = editor.getCursor();
		const line = editor.getLine(cursor.line) ?? "";
		const prefix = line.slice(0, cursor.ch);
		const firstNonSpace = prefix.search(/\S/);
		const start = firstNonSpace >= 0 ? firstNonSpace : cursor.ch;
		const text = prefix.slice(start);

		return {
			text,
			range: {
				from: { line: cursor.line, ch: start },
				to: cursor,
			},
		};
	}

	private expandQueryStart(line: string, startCh: number): number {
		let boundary = startCh;
		while (boundary > 0 && /\s/.test(line[boundary - 1])) {
			boundary--;
		}
		while (boundary > 0 && !/\s/.test(line[boundary - 1])) {
			boundary--;
		}
		return boundary;
	}

	private getPreviousLineBeforeCursor(
		editor: Editor,
		cursor: EditorPosition
	): { text: string; range: { from: EditorPosition; to: EditorPosition } } | null {
		if (cursor.line === 0) return null;
		const prevLine = editor.getLine(cursor.line - 1) ?? "";
		const trimmedStart = prevLine.search(/\S/);
		if (trimmedStart === -1) return null;
		return {
			text: prevLine.slice(trimmedStart),
			range: {
				from: { line: cursor.line - 1, ch: trimmedStart },
				to: { line: cursor.line - 1, ch: prevLine.length },
			},
		};
	}

	private getQueryContext(
		editor: Editor,
		provided?: string
	): { text: string; range: { from: EditorPosition; to: EditorPosition } } {
		// Try to resolve query context with prefix info
		const resolved = this.resolveQueryContext(editor);
		if (resolved) {
			const spansMultipleLines =
				resolved.range.from.line !== resolved.range.to.line;
			// Use regex fallback for multi-line window-limited queries
			if (resolved.windowLimited && spansMultipleLines) {
				return this.buildRegexQueryContext(editor);
			}
			return {
				text: resolved.text,
				range: resolved.range,
			};
		}

		// Use provided query if available
		if (provided && provided.length > 0) {
			const cursor = editor.getCursor();
			const startCh = Math.max(0, cursor.ch - provided.length);
			return {
				text: provided,
				range: {
					from: { line: cursor.line, ch: startCh },
					to: cursor,
				},
			};
		}

		// Final fallback: regex-based query context
		return this.buildRegexQueryContext(editor);
	}

	private positionContainer(coords: { top: number; left: number }): void {
		if (!this.container) return;

		const margin = 12;
		const containerRect = this.container.getBoundingClientRect();
		const width = containerRect.width || 300;
		const height = containerRect.height || 200;
		const maxLeft = Math.max(margin, window.innerWidth - width - margin);
		const maxTop = Math.max(margin, window.innerHeight - height - margin);
		const clampedLeft = Math.min(Math.max(margin, coords.left), maxLeft);
		const clampedTop = Math.min(Math.max(margin, coords.top), maxTop);

		this.container.style.left = `${clampedLeft}px`;
		this.container.style.top = `${clampedTop}px`;
	}

	private handleReposition(): void {
		if (!this.currentEditor) return;
		const coords = getCursorCoords(this.currentEditor);
		this.anchorCoords = coords;
		this.positionContainer(coords);
	}

	private captureInitialSelection(editor: Editor): void {
		const from = editor.getCursor("from");
		const to = editor.getCursor("to");
		this.initialSelection = { from, to };
		this.hadInitialSelection = from.line !== to.line || from.ch !== to.ch;
	}

	private tryPrefixMatch(
		snippet: ParsedSnippet,
		editor: Editor,
		cursor: EditorPosition
	): { from: EditorPosition; to: EditorPosition } | null {
		const prefix = snippet.prefix;
		const startCh = cursor.ch - prefix.length;
		if (startCh < 0) return null;

		const from = { line: cursor.line, ch: startCh };
		const existingText = editor.getRange(from, cursor);
		if (existingText && existingText.toLowerCase() === prefix.toLowerCase()) {
			return { from, to: cursor };
		}
		return null;
	}

	private tryPrefixOverlapMatch(
		snippet: ParsedSnippet,
		editor: Editor,
		cursor: EditorPosition
	): { from: EditorPosition; to: EditorPosition } | null {
		const overlapLength = this.findPrefixOverlapLength(snippet, editor);
		if (overlapLength > 0) {
			return {
				from: { line: cursor.line, ch: cursor.ch - overlapLength },
				to: cursor,
			};
		}
		return null;
	}

	private tryMatchFieldMatch(
		snippet: ParsedSnippet,
		cursor: EditorPosition
	): { from: EditorPosition; to: EditorPosition } | null {
		const matchField = this.getMatchField(snippet);
		if (matchField && matchField.length > 0) {
			const fromCh = Math.max(0, cursor.ch - matchField.length);
			return {
				from: { line: cursor.line, ch: fromCh },
				to: cursor,
			};
		}
		return null;
	}

	private getReplacementRange(
		snippet: ParsedSnippet,
		editor: Editor
	): { from: EditorPosition; to: EditorPosition } {
		const cursor = editor.getCursor();

		// Early returns for special cases
		if (this.emptyStateMessage) {
			return { from: cursor, to: cursor };
		}

		if (this.initialSelection && this.hadInitialSelection) {
			return {
				from: this.initialSelection.from,
				to: this.initialSelection.to,
			};
		}

		// Try different matching strategies in priority order
		const prefixMatch = this.tryPrefixMatch(snippet, editor, cursor);
		if (prefixMatch) return prefixMatch;

		const overlapMatch = this.tryPrefixOverlapMatch(snippet, editor, cursor);
		if (overlapMatch) return overlapMatch;

		const matchFieldMatch = this.tryMatchFieldMatch(snippet, cursor);
		if (matchFieldMatch) return matchFieldMatch;

		const anchorRange = this.getAnchorRange(editor);
		if (anchorRange) return anchorRange;

		// Fallback to query context
		const fallbackContext = this.getQueryContext(editor, this.currentQuery);
		this.queryAnchorPos = fallbackContext.range.from;
		return fallbackContext.range;
	}

	private getAnchorRange(
		editor: Editor
	): { from: EditorPosition; to: EditorPosition } | null {
		if (!this.queryAnchorPos) return null;
		const cursor = editor.getCursor();
		const anchorOffset = posToOffset(editor, this.queryAnchorPos);
		const cursorOffset = posToOffset(editor, cursor);
		if (cursorOffset < anchorOffset) {
			return null;
		}
		return {
			from: this.queryAnchorPos,
			to: cursor,
		};
	}

	private getMatchField(snippet: ParsedSnippet): string | undefined {
		return this.snippetMatchFields.get(snippet);
	}

	private findPrefixOverlapLength(
		snippet: ParsedSnippet,
		editor: Editor
	): number {
		const cursor = editor.getCursor();
		const lineText = editor.getLine(cursor.line) ?? "";
		const beforeCursor = lineText.slice(0, cursor.ch);
		if (!beforeCursor) return 0;

		const prefixLower = snippet.prefix.toLowerCase();
		const textLower = beforeCursor.toLowerCase();
		const maxLength = Math.min(prefixLower.length, textLower.length);

		for (let len = maxLength; len > 0; len--) {
			const textSuffix = textLower.slice(-len);
			const prefixSub = prefixLower.substring(0, len);
			if (textSuffix === prefixSub) {
				return len;
			}
		}

		return 0;
	}

	private matchesBinding(
		event: KeyboardEvent,
		binding: string | undefined,
		fallbackKey?: string
	): boolean {
		const parsed = this.parseKeyBinding(binding);
		if (parsed && this.eventMatchesBinding(event, parsed)) {
			return true;
		}
		if (
			!binding &&
			fallbackKey &&
			(event.ctrlKey || event.metaKey) &&
			!event.altKey &&
			!event.shiftKey &&
			event.key.toLowerCase() === fallbackKey
		) {
			return true;
		}
		return false;
	}

	private parseKeyBinding(binding?: string): {
		key: string;
		ctrl?: boolean;
		meta?: boolean;
		shift?: boolean;
		alt?: boolean;
		mod?: boolean;
	} | null {
		if (!binding) return null;
		const parts = binding
			.split(/[-+]/)
			.map((part) => part.trim().toLowerCase())
			.filter(Boolean);
		if (parts.length === 0) return null;
		const key = parts.pop() as string;
		const modifiers: Record<string, boolean> = {};
		for (const part of parts) {
			if (part === "cmd" || part === "meta") modifiers.meta = true;
			if (part === "ctrl" || part === "control") modifiers.ctrl = true;
			if (part === "shift") modifiers.shift = true;
			if (part === "alt" || part === "option") modifiers.alt = true;
			if (part === "mod") modifiers.mod = true;
		}
		return { key, ...modifiers };
	}

	private eventMatchesBinding(
		event: KeyboardEvent,
		binding: {
			key: string;
			ctrl?: boolean;
			meta?: boolean;
			shift?: boolean;
			alt?: boolean;
			mod?: boolean;
		}
	): boolean {
		const key = binding.key === "space" ? " " : binding.key;
		if (event.key.toLowerCase() !== key.toLowerCase()) return false;

		const hasMod = event.ctrlKey || event.metaKey;
		if (binding.mod && !hasMod) return false;
		if (!binding.mod && hasMod && !binding.ctrl && !binding.meta) return false;
		if ((binding.ctrl ?? false) !== event.ctrlKey && !binding.mod) return false;
		if ((binding.meta ?? false) !== event.metaKey && !binding.mod) return false;
		if ((binding.shift ?? false) !== event.shiftKey) return false;
		if ((binding.alt ?? false) !== event.altKey) return false;

		return true;
	}

	private updateEntriesForQuery(query: string): boolean {
		const visibleSnippets = this.getVisibleSnippets();
		const totalSnippetCount = this.options.getSnippets().length;
		const hiddenCount = Math.max(totalSnippetCount - visibleSnippets.length, 0);
		
		const filterResult = this.performFiltering(query, visibleSnippets);
		const algorithms = this.options.getRankingAlgorithms();
		const rankingContext = this.buildRankingContext(
			filterResult.bestCandidate ?? query ?? ""
		);

		if (filterResult.filtered.length > 0) {
			return this.handleFilteredResults(
				filterResult,
				query,
				visibleSnippets,
				hiddenCount,
				algorithms,
				rankingContext
			);
		}

		return this.handleNoFilteredResults(
			query,
			visibleSnippets,
			hiddenCount,
			filterResult.searchDuration,
			algorithms,
			rankingContext
		);
	}

	private performFiltering(
		query: string,
		visibleSnippets: ParsedSnippet[]
	): {
		filtered: ParsedSnippet[];
		matchFields: Map<ParsedSnippet, string>;
		bestCandidate: string | undefined;
		searchDuration: number;
	} {
		const searchStart = getMonotonicTime();
		const filterResult = this.filterSnippets(query, visibleSnippets);
		const searchDuration = getMonotonicTime() - searchStart;
		
		this.snippetMatchFields = filterResult.matchFields;
		
		return {
			filtered: filterResult.snippets,
			matchFields: filterResult.matchFields,
			bestCandidate: filterResult.bestCandidate,
			searchDuration,
		};
	}

	private handleFilteredResults(
		filterResult: {
			filtered: ParsedSnippet[];
			searchDuration: number;
		},
		query: string,
		visibleSnippets: ParsedSnippet[],
		hiddenCount: number,
		algorithms: RankingAlgorithmSetting[],
		rankingContext: { query: string; usage?: Map<string, number> }
	): boolean {
		const rankingStart = getMonotonicTime();
		this.entries = rankSnippets(filterResult.filtered, algorithms, rankingContext);
		const rankingDuration = getMonotonicTime() - rankingStart;
		
		this.emptyStateMessage = null;
		
		this.logQueryTelemetry({
			query,
			fallback: false,
			entriesCount: this.entries.length,
			filteredCount: filterResult.filtered.length,
			visibleCount: visibleSnippets.length,
			hiddenCount,
			searchDuration: filterResult.searchDuration,
			rankingDuration,
			algorithms,
		});
		
		return true;
	}

	private handleNoFilteredResults(
		query: string,
		visibleSnippets: ParsedSnippet[],
		hiddenCount: number,
		searchDuration: number,
		algorithms: RankingAlgorithmSetting[],
		rankingContext: { query: string; usage?: Map<string, number> }
	): boolean {
		if (visibleSnippets.length === 0) {
			this.snippetMatchFields = new Map();
			this.entries = [];
			this.emptyStateMessage = null;
			return false;
		}

		const rankingStart = getMonotonicTime();
		this.entries = rankSnippets(visibleSnippets, algorithms, rankingContext);
		const rankingDuration = getMonotonicTime() - rankingStart;
		
		const displayQuery = query ?? "";
		const sourceLabel = this.getCurrentSource();
		const sourceHint =
			sourceLabel && sourceLabel !== "all"
				? ` in ${this.getCurrentSourceLabel()}`
				: "";
		this.emptyStateMessage = displayQuery
			? `No snippets match "${displayQuery}"${sourceHint}. Showing all snippets.`
			: null;
		
		this.logQueryTelemetry({
			query,
			fallback: true,
			entriesCount: this.entries.length,
			filteredCount: 0,
			visibleCount: visibleSnippets.length,
			hiddenCount,
			searchDuration,
			rankingDuration,
			algorithms,
		});
		
		return true;
	}

	private logQueryTelemetry(data: {
		query: string;
		fallback: boolean;
		entriesCount: number;
		filteredCount: number;
		visibleCount: number;
		hiddenCount: number;
		searchDuration: number;
		rankingDuration: number;
		algorithms: RankingAlgorithmSetting[];
	}): void {
		const { query, fallback, entriesCount, filteredCount, visibleCount, hiddenCount, searchDuration, rankingDuration, algorithms } =
			data;
		const enabledAlgorithms = algorithms
			.filter((algo) => algo.enabled)
			.map((algo) => algo.id)
			.join(", ");
		const message = `[Telemetry] query="${query}" fallback=${fallback} visible=${visibleCount} hidden=${hiddenCount} filtered=${filteredCount} entries=${entriesCount} search=${searchDuration.toFixed(
			2
		)}ms rank=${rankingDuration.toFixed(2)}ms algos=[${enabledAlgorithms || "none"}]`;
		this.options.logger.debug("menu", message);
	}

	private buildRankingContext(query: string) {
		return {
			query,
			usage: this.options.getUsageCounts?.(),
		};
	}

	private renderSourceBadge(listEl: HTMLElement): void {
		this.sourceLabelEl = null;
		const sources = this.getSourceList();
		if (sources.length <= 1) return;

		const wrapper = listEl.createDiv({
			cls: "snippet-source-badge",
		});
		const label = wrapper.createSpan({
			cls: "snippet-source-label",
			text: `Source: ${this.getCurrentSourceLabel()}`,
		});
		this.sourceLabelEl = label;

		const hint = this.options.getMenuKeymap?.();
		const nextKey = hint?.sourceNext;
		const prevKey = hint?.sourcePrev;
		if (nextKey || prevKey) {
			wrapper.createSpan({
				cls: "snippet-source-hint",
				text: ` (${prevKey ?? ""}${prevKey && nextKey ? "/" : ""}${nextKey ?? ""})`,
			});
		}

		wrapper.addEventListener("click", () => {
			this.navigateSource(1);
		});
	}

	private updateSourceLabel(): void {
		if (!this.sourceLabelEl) return;
		this.sourceLabelEl.textContent = `Source: ${this.getCurrentSourceLabel()}`;
	}

	private populateList(listEl: HTMLElement): void {
		listEl.empty();

		this.renderSourceBadge(listEl);

		const algorithms = this.options.getRankingAlgorithms();
		const enabled = algorithms.filter((algo) => algo.enabled);
		const names = this.options.getRankingAlgorithmNames();
		if (enabled.length > 0) {
			const order = enabled
				.map((algo) => names[algo.id] ?? algo.id)
				.join(" ▶ ");
			const badge = listEl.createDiv({
				cls: "snippet-ranking-badge",
				text: `Ranking: ${order}`,
			});
			badge.setAttribute("title", `Active algorithms: ${order}`);
		}

		if (this.emptyStateMessage) {
			listEl.createDiv({
				cls: "snippet-completion-empty",
				text: this.emptyStateMessage,
			});
		}

		this.entries.forEach((snippet, index) => {
			const item = listEl.createDiv({
				cls: "snippet-completion-item",
			});

			item.dataset.index = index.toString();

			const titleEl = item.createDiv({
				cls: "snippet-completion-title",
			});
			this.renderTitleWithOverlap(titleEl, snippet);

			if (snippet.description) {
				item.createDiv({
					cls: "snippet-completion-desc",
					text: snippet.description,
				});
			}

			item.addEventListener("mousedown", (event) => {
				event.preventDefault();

				this.applySelection(index);
			});

			item.addEventListener("mouseenter", () => {
				if (!this.mouseMovedSinceOpen) return;
				this.selectIndex(index, { preventScroll: true });
			});
		});
	}

	private handlePointerMove(): void {
		this.mouseMovedSinceOpen = true;
	}

	private renderTitleWithOverlap(
		titleEl: HTMLElement,
		snippet: ParsedSnippet
	): void {
		const prefix = snippet.prefix;
		const shouldHighlight = !!this.emptyStateMessage;
		if (!shouldHighlight || !this.currentEditor) {
			titleEl.setText(prefix);
			return;
		}
		const overlap = this.findPrefixOverlapLength(
			snippet,
			this.currentEditor
		);
		if (overlap <= 0) {
			titleEl.setText(prefix);
			return;
		}
		const before = prefix.slice(0, overlap);
		const after = prefix.slice(overlap);
		titleEl.empty();
		if (before) {
			titleEl.createSpan({
				cls: "snippet-completion-match",
				text: before,
			});
		}
		if (after) {
			titleEl.createSpan({
				text: after,
			});
		}
	}
}
