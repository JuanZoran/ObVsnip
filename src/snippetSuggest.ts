import { App, Editor, MarkdownView } from "obsidian";

import type { ParsedSnippet } from "./types";

import { SnippetManager } from "./snippetManager";

import { PluginLogger } from "./logger";

import { getEditorView } from "./editorUtils";

interface SnippetMenuOptions {
	getSnippets: () => ParsedSnippet[];

	manager: SnippetManager;

	logger: PluginLogger;
}

export class SnippetCompletionMenu {
	private container: HTMLElement | null = null;

	private listEl: HTMLElement | null = null;

	private previewTitleEl: HTMLElement | null = null;

	private previewDescEl: HTMLElement | null = null;

	private previewBodyEl: HTMLElement | null = null;

	private entries: ParsedSnippet[] = [];

	private activeIndex = 0;

	private boundKeydown: (event: KeyboardEvent) => void;

	private boundClick: (event: MouseEvent) => void;

	private currentEditor: Editor | null = null;

	private currentQuery = "";

	private emptyStateMessage: string | null = null;

	constructor(private app: App, private options: SnippetMenuOptions) {
		this.boundKeydown = this.handleKeydown.bind(this);

		this.boundClick = this.handleClickOutside.bind(this);
	}

	open(editor?: Editor | null, initialQuery = ""): boolean {
		const targetEditor = editor ?? this.getActiveEditor();

		if (!targetEditor) {
			this.options.logger.debug("[SnippetMenu] open: no active editor");

			return false;
		}

		this.close();

		this.currentEditor = targetEditor;

		this.currentQuery = initialQuery ?? "";

		const hasEntries = this.updateEntriesForQuery(this.currentQuery);

		if (!hasEntries) {
			this.options.logger.debug(
				"[SnippetMenu] open: no snippets match query"
			);

			return false;
		}

		const coords = this.getCursorCoords(targetEditor);

		this.render(coords);

		this.selectIndex(0);

		window.addEventListener("keydown", this.boundKeydown, true);

		window.addEventListener("mousedown", this.boundClick, true);

		return true;
	}

	close(): void {
		if (this.container?.parentElement) {
			this.container.remove();
		}

		this.container = null;

		window.removeEventListener("keydown", this.boundKeydown, true);

		window.removeEventListener("mousedown", this.boundClick, true);

		this.currentEditor = null;
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

	private getActiveEditor(): Editor | null {
		return (
			this.app.workspace.getActiveViewOfType(MarkdownView)?.editor ?? null
		);
	}

	private filterSnippets(query: string): ParsedSnippet[] {
		const normalized = query.trim().toLowerCase();

		const snippets = this.options.getSnippets();

		if (!normalized) return snippets;

		return snippets.filter(
			(snippet) =>
				snippet.prefix.toLowerCase().includes(normalized) ||
				(snippet.description?.toLowerCase().includes(normalized) ??
					false)
		);
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

		this.previewBodyEl = preview.createEl("pre", {
			cls: "snippet-preview-body",
		});

		document.body.appendChild(container);

		this.container = container;
	}

	private selectIndex(index: number): void {
		if (!this.listEl || this.entries.length === 0) return;

		if (index < 0) index = this.entries.length - 1;

		if (index >= this.entries.length) index = 0;

		this.activeIndex = index;

		const items = Array.from(
			this.listEl.querySelectorAll<HTMLElement>(".snippet-completion-item")
		);

		items.forEach((item, idx) =>
			item.toggleClass("is-selected", idx === index)
		);

		this.updatePreview(this.entries[index]);

		const activeItem = items[index];

		if (activeItem) {
			activeItem.scrollIntoView({ block: "nearest" });
		}
	}

	private updatePreview(snippet: ParsedSnippet): void {
		if (!this.previewTitleEl || !this.previewDescEl || !this.previewBodyEl)
			return;

		this.previewTitleEl.textContent = snippet.prefix;

		this.previewDescEl.textContent = snippet.description ?? "";

		this.previewDescEl.toggleClass("is-hidden", !snippet.description);

		const previewBody = snippet.processedText ?? snippet.body;

		this.previewBodyEl.textContent = previewBody;
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

		const cursor = this.currentEditor.getCursor();

		const latestQuery = this.extractQuery(this.currentEditor);

		const prefixLength = latestQuery.length;

		const from = {
			line: cursor.line,

			ch: Math.max(0, cursor.ch - prefixLength),
		};

		this.currentEditor.setSelection(from, cursor);

		this.options.logger.debug(
			`[SnippetMenu] Applying snippet ${snippet.prefix}, replacing prefix "${latestQuery}"`
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

		const match = prefix.match(/(\S+)$/);

		return match?.[0] ?? "";
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

		this.entries = allSnippets;
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
		});
	}
}
