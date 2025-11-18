import { App, Editor, type EditorPosition } from "obsidian";
import { rankSnippets } from "./snippetRankingPipeline";

import type {
	ParsedSnippet,
	PrefixInfo,
	RankingAlgorithmId,
	RankingAlgorithmSetting,
} from "./types";

import { SnippetManager } from "./snippetManager";

import { PluginLogger } from "./logger";

import { getActiveEditor, getEditorView } from "./editorUtils";
import { getContextBeforeCursor } from "./prefixContext";
import { getMonotonicTime } from "./telemetry";

interface SnippetMenuOptions {
	getSnippets: () => ParsedSnippet[];

	manager: SnippetManager;

	logger: PluginLogger;

	getRankingAlgorithms: () => RankingAlgorithmSetting[];
	getUsageCounts?: () => Map<string, number>;
	getPrefixInfo?: () => PrefixInfo;
	getRankingAlgorithmNames: () => Record<RankingAlgorithmId, string>;
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

export class SnippetCompletionMenu {
	private container: HTMLElement | null = null;

	private listEl: HTMLElement | null = null;

	private previewTitleEl: HTMLElement | null = null;

	private previewDescEl: HTMLElement | null = null;

	private previewBodyEl: HTMLElement | null = null;

	private previewStopsEl: HTMLElement | null = null;

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

		const coords = this.getCursorCoords(targetEditor);
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

	acceptCurrent(): boolean {
		if (!this.isOpen()) return false;

		this.applySelection(this.activeIndex);

		return true;
	}

	private getVisibleSnippets(): ParsedSnippet[] {
		return this.options.getSnippets().filter((snippet) => !snippet.hide);
	}

	private filterSnippets(
		query: string,
		candidates?: ParsedSnippet[]
	): ParsedSnippet[] {
		const normalized = query.trim().toLowerCase();

		const snippets = candidates ?? this.getVisibleSnippets();

		if (!normalized) {
			return snippets;
		}

		const filtered: ParsedSnippet[] = [];
		const seen = new Set<ParsedSnippet>();

		const tryAddSnippet = (snippet: ParsedSnippet) => {
			if (seen.has(snippet)) return;
			seen.add(snippet);
			filtered.push(snippet);
		};

		for (const snippet of snippets) {
			const prefixLower = snippet.prefix.toLowerCase();
			if (prefixLower.startsWith(normalized)) {
				tryAddSnippet(snippet);
				continue;
			}

			if (
				snippet.description?.toLowerCase().includes(normalized) ??
				false
			) {
				tryAddSnippet(snippet);
				continue;
			}

			if (matchesFuzzy(prefixLower, normalized)) {
				tryAddSnippet(snippet);
			}
		}

		return filtered;
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

		const rawBody = snippet.body ?? snippet.processedText ?? "";

		this.previewBodyEl.textContent = rawBody;

		if (this.previewStopsEl) {
			const stops = (snippet.tabStops ?? []).map((stop) => `$${stop.index}`);
			this.previewStopsEl.textContent =
				stops.length > 0 ? `Tab stops: ${stops.join(", ")}` : "";
			this.previewStopsEl.toggleClass("is-hidden", stops.length === 0);
		}
	}

	private handleKeydown(event: KeyboardEvent): void {
		if (!this.container || !this.currentEditor) return;

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

	private getCursorCoords(editor: Editor): { top: number; left: number } {
		const cursor = editor.getCursor();

		const editorView = getEditorView(editor);

		if (editorView) {
			const offset = editor.posToOffset(cursor);

			const coords = editorView.coordsAtPos(offset);

			if (coords) {
				return { top: coords.bottom + 4, left: coords.left };
			}
		}

		const line = editor.getLine(cursor.line) ?? "";

		const charWidth = 8;

		const top = cursor.line * 20 + 40;

		const left = line.length * charWidth + 40;

		return { top, left };
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
		let from = editor.offsetToPos(context.startOffset);
		const span = context.endOffset - context.startOffset;
		const windowLimited =
			span >= prefixInfo.maxLength && prefixInfo.maxLength > 0;
		let text = context.text;
		let range = {
			from,
			to: cursor,
		};

		if (windowLimited) {
			const previousLineContext = this.getPreviousLineBeforeCursor(
				editor,
				cursor
			);
			if (previousLineContext) {
				text = previousLineContext.text;
				range = previousLineContext.range;
				from = range.from;
			} else if (from.line === cursor.line) {
				const line = editor.getLine(cursor.line) ?? "";
				const expandedStart = this.expandQueryStart(line, from.ch);
				if (expandedStart !== from.ch) {
					text = line.slice(expandedStart, cursor.ch);
					range = {
						from: { line: cursor.line, ch: expandedStart },
						to: cursor,
					};
					from = range.from;
				}
			}
		}

		return {
			text,
			range,
			windowLimited,
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
		const resolved = this.resolveQueryContext(editor);
		if (resolved) {
			const spansMultipleLines =
				resolved.range.from.line !== resolved.range.to.line;
			if (resolved.windowLimited && spansMultipleLines) {
				return this.buildRegexQueryContext(editor);
			}
			return {
				text: resolved.text,
				range: resolved.range,
			};
		}
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
		const fallback = this.buildRegexQueryContext(editor);
		return fallback;
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
		const coords = this.getCursorCoords(this.currentEditor);
		this.anchorCoords = coords;
		this.positionContainer(coords);
	}

	private captureInitialSelection(editor: Editor): void {
		const from = editor.getCursor("from");
		const to = editor.getCursor("to");
		this.initialSelection = { from, to };
		this.hadInitialSelection = from.line !== to.line || from.ch !== to.ch;
	}

	private getReplacementRange(
		snippet: ParsedSnippet,
		editor: Editor
	): { from: EditorPosition; to: EditorPosition } {
		const cursor = editor.getCursor();

		if (this.emptyStateMessage) {
			return { from: cursor, to: cursor };
		}

		if (this.initialSelection && this.hadInitialSelection) {
			return {
				from: this.initialSelection.from,
				to: this.initialSelection.to,
			};
		}

		const prefix = snippet.prefix;
		const startCh = cursor.ch - prefix.length;
		if (startCh >= 0) {
			const from = { line: cursor.line, ch: startCh };
			const existingText = editor.getRange(from, cursor);
			if (
				existingText &&
				existingText.toLowerCase() === prefix.toLowerCase()
			) {
				return { from, to: cursor };
			}
		}

		const overlapLength = this.findPrefixOverlapLength(snippet, editor);
		if (overlapLength > 0) {
			return {
				from: { line: cursor.line, ch: cursor.ch - overlapLength },
				to: cursor,
			};
		}

		const anchorRange = this.getAnchorRange(editor);
		if (anchorRange) {
			return anchorRange;
		}

		const fallbackContext = this.getQueryContext(
			editor,
			this.currentQuery
		);
		this.queryAnchorPos = fallbackContext.range.from;
		return fallbackContext.range;
	}

	private getAnchorRange(
		editor: Editor
	): { from: EditorPosition; to: EditorPosition } | null {
		if (!this.queryAnchorPos) return null;
		const cursor = editor.getCursor();
		const anchorOffset = editor.posToOffset(this.queryAnchorPos);
		const cursorOffset = editor.posToOffset(cursor);
		if (cursorOffset < anchorOffset) {
			return null;
		}
		return {
			from: this.queryAnchorPos,
			to: cursor,
		};
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

	private updateEntriesForQuery(query: string): boolean {
		const visibleSnippets = this.getVisibleSnippets();
		const totalSnippetCount = this.options.getSnippets().length;
		const hiddenCount = Math.max(totalSnippetCount - visibleSnippets.length, 0);
		const searchStart = getMonotonicTime();
		const filtered = this.filterSnippets(query, visibleSnippets);
		const searchDuration = getMonotonicTime() - searchStart;
		const algorithms = this.options.getRankingAlgorithms();
		const rankingContext = this.buildRankingContext(query);

		if (filtered.length > 0) {
			const rankingStart = getMonotonicTime();
			this.entries = rankSnippets(filtered, algorithms, rankingContext);
			const rankingDuration = getMonotonicTime() - rankingStart;
			this.emptyStateMessage = null;
			this.logQueryTelemetry({
				query,
				fallback: false,
				entriesCount: this.entries.length,
				filteredCount: filtered.length,
				visibleCount: visibleSnippets.length,
				hiddenCount,
				searchDuration,
				rankingDuration,
				algorithms,
			});
			return true;
		}

		if (visibleSnippets.length === 0) {
			this.entries = [];
			this.emptyStateMessage = null;
			return false;
		}

		const rankingStart = getMonotonicTime();
		this.entries = rankSnippets(visibleSnippets, algorithms, rankingContext);
		const rankingDuration = getMonotonicTime() - rankingStart;
		const displayQuery = query ?? "";
		this.emptyStateMessage = displayQuery
			? `No snippets match "${displayQuery}". Showing all snippets.`
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

	private populateList(listEl: HTMLElement): void {
		listEl.empty();

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
