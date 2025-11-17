import { App, Editor, type EditorPosition } from "obsidian";

import type { ParsedSnippet } from "./types";

import { SnippetManager } from "./snippetManager";

import { PluginLogger } from "./logger";

import { getActiveEditor, getEditorView } from "./editorUtils";

export type SnippetSortMode = "none" | "smart" | "prefix-length";

interface SnippetMenuOptions {
	getSnippets: () => ParsedSnippet[];

	manager: SnippetManager;

	logger: PluginLogger;

	getSortMode: () => SnippetSortMode;
}

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

		this.currentQuery = initialQuery ?? "";
		this.setQueryAnchor(targetEditor);

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

	private filterSnippets(query: string): ParsedSnippet[] {
		const normalized = query.trim().toLowerCase();

		const snippets = this.options.getSnippets();

		if (!normalized) {
			return this.applySort([...snippets], normalized, true);
		}

		const prefixMatches = snippets.filter((snippet) =>
			snippet.prefix.toLowerCase().startsWith(normalized)
		);
		const descriptionMatches = snippets.filter(
			(snippet) =>
				!snippet.prefix.toLowerCase().includes(normalized) &&
				(snippet.description?.toLowerCase().includes(normalized) ??
					false)
		);

		return [
			...this.applySort(prefixMatches, normalized, false),
			...this.applySort(descriptionMatches, normalized, false),
		];
	}

	private applySort(
		entries: ParsedSnippet[],
		normalizedQuery: string,
		isEmptyQuery: boolean
	): ParsedSnippet[] {
		const mode = this.options.getSortMode?.() ?? "none";
		if (mode === "none") {
			return entries;
		}

		if (mode === "prefix-length") {
			return this.sortByLength(entries);
		}

		if (!normalizedQuery) {
			if (isEmptyQuery) {
				return entries;
			}
			return this.sortByLength(entries);
		}

		const scored = entries.map((snippet) => {
			const priority = this.getSmartPriority(snippet, normalizedQuery);
			return {
				snippet,
				priority,
				length: snippet.prefix.length,
				alpha: snippet.prefix.toLowerCase(),
			};
		});

		scored.sort((a, b) => {
			if (a.priority !== b.priority) {
				return a.priority - b.priority;
			}
			if (a.length !== b.length) {
				return a.length - b.length;
			}
			return a.alpha.localeCompare(b.alpha);
		});

		return scored.map((item) => item.snippet);
	}

	private sortByLength(entries: ParsedSnippet[]): ParsedSnippet[] {
		return [...entries].sort((a, b) => {
			const lengthDiff = a.prefix.length - b.prefix.length;
			if (lengthDiff !== 0) return lengthDiff;
			return a.prefix.localeCompare(b.prefix);
		});
	}

	private getSmartPriority(snippet: ParsedSnippet, query: string): number {
		const prefixLower = snippet.prefix.toLowerCase();
		if (prefixLower === query) return 0;
		if (prefixLower.startsWith(query)) return 1;
		if (prefixLower.includes(query)) return 2;
		if (snippet.description?.toLowerCase().includes(query)) return 3;
		return 4;
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

		const newQuery = this.extractQuery(this.currentEditor);

		if (newQuery === this.currentQuery) return;

		this.currentQuery = newQuery;

		const hasEntries = this.updateEntriesForQuery(this.currentQuery);

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

	private extractQuery(editor: Editor): string {
		const cursor = editor.getCursor();

		const line = editor.getLine(cursor.line) ?? "";

		const prefix = line.slice(0, cursor.ch);

		const asciiMatch = prefix.match(/([a-zA-Z0-9_]+)$/);
		const match = asciiMatch ?? prefix.match(/(\S+)$/);

		return match?.[0] ?? "";
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

		const latestQuery = this.extractQuery(editor);
		const queryStart = Math.max(0, cursor.ch - latestQuery.length);
		return {
			from: { line: cursor.line, ch: queryStart },
			to: cursor,
		};
	}

	private setQueryAnchor(editor: Editor): void {
		const cursor = editor.getCursor();
		const initialQuery = this.currentQuery ?? "";
		const startCh = Math.max(0, cursor.ch - initialQuery.length);
		this.queryAnchorPos = { line: cursor.line, ch: startCh };
	}

	private getAnchorRange(
		editor: Editor
	): { from: EditorPosition; to: EditorPosition } | null {
		if (!this.queryAnchorPos) return null;
		const cursor = editor.getCursor();
		if (cursor.line !== this.queryAnchorPos.line) {
			return null;
		}
		if (cursor.ch < this.queryAnchorPos.ch) {
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
		const filtered = this.filterSnippets(query);
		if (filtered.length > 0) {
			this.entries = filtered;
			this.emptyStateMessage = null;
			return true;
		}

		const allSnippets = this.options.getSnippets();
		if (allSnippets.length === 0) {
			this.entries = [];
			this.emptyStateMessage = null;
			return false;
		}

		const normalized = query.trim().toLowerCase();
		this.entries = this.applySort(
			[...allSnippets],
			normalized,
			normalized.length === 0
		);
		this.emptyStateMessage = query
			? `No snippets match "${query}". Showing all snippets.`
			: null;
		return true;
	}

	private populateList(listEl: HTMLElement): void {
		listEl.empty();

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

			item.createDiv({
				cls: "snippet-completion-title",
				text: snippet.prefix,
			});

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
}
