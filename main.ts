import { App, Editor, MarkdownView, Plugin, Notice } from "obsidian";
import { Compartment } from "@codemirror/state";
import type { Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { ParsedSnippet, SnippetMenuKeymap } from "./src/types";
import { SnippetLoader } from "./src/snippetLoader";
import { SnippetEngine } from "./src/snippetEngine";
import {
	snippetSessionExtensions,
	setSnippetWidgetConfig,
} from "./src/snippetSession";
import { SnippetManager } from "./src/snippetManager";
import { PluginLogger } from "./src/logger";
import { getEditorView } from "./src/editorUtils";
import { TextSnippetsSettingsTab } from "./src/settingsTab";
import { buildTriggerKeymapExtension } from "./src/keymap";
import { SnippetCompletionMenu } from "./src/snippetSuggest";

interface PluginSettings {
	snippetsFilePath: string;
	snippets: ParsedSnippet[];
	showVirtualText: boolean;
	virtualTextColor: string;
	enableDebugLogs: boolean;
	triggerKey: string;
	autoShowMenu: boolean;
	menuKeymap: SnippetMenuKeymap;
}

const DEFAULT_SETTINGS: PluginSettings = {
	snippetsFilePath: "",
	snippets: [],
	showVirtualText: true,
	virtualTextColor: "var(--text-muted)",
	enableDebugLogs: false,
	triggerKey: "Tab",
	autoShowMenu: true,
	menuKeymap: {
		next: "ArrowDown",
		prev: "ArrowUp",
		accept: "Enter",
		toggle: "Mod-Shift-S",
	},
};

export default class TextSnippetsPlugin extends Plugin {
	settings: PluginSettings;
	private snippetLoader: SnippetLoader;
	private snippetEngine: SnippetEngine;
	private triggerKeymapCompartment = new Compartment();
	private snippetManager: SnippetManager;
	private logger = new PluginLogger();
	private snippetMenu: SnippetCompletionMenu;
	async onload() {
		await this.loadSettings();
		this.logger.debug("🚀 Loading Text Snippets plugin");

		this.snippetLoader = new SnippetLoader(this.app, this.logger);
		this.snippetEngine = new SnippetEngine([]);
		this.snippetManager = new SnippetManager(
			this.app,
			this.snippetEngine,
			this.logger
		);

		if (this.settings.snippetsFilePath) {
			const runLoad = async () => {
				await this.loadSnippetsFromFile();
			};
			if (this.app.workspace.layoutReady) {
				void runLoad();
			} else {
				this.app.workspace.onLayoutReady(() => {
					void runLoad();
				});
			}
		}

		this.addSettingTab(new TextSnippetsSettingsTab(this.app, this));
		this.registerCommands();
		this.registerEditorExtension(snippetSessionExtensions);
		this.registerEditorExtension(
			this.triggerKeymapCompartment.of(
				this.createTriggerKeymapExtension()
			)
		);
		this.snippetMenu = new SnippetCompletionMenu(this.app, {
			getSnippets: () => this.snippetEngine.getSnippets(),
			manager: this.snippetManager,
			logger: this.logger,
		});
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => {
				this.reconfigureTriggerKeymap();
			})
		);
		this.applyRuntimeSettings();
		const keydownHandler = (event: KeyboardEvent) =>
			this.handleGlobalKeydown(event);
		window.addEventListener("keydown", keydownHandler, true);
		this.register(() =>
			window.removeEventListener("keydown", keydownHandler, true)
		);

		this.logger.debug("✅ Text Snippets plugin loaded");
	}

	onunload() {
		this.logger.debug("🛑 Unloading Text Snippets plugin");
		this.snippetMenu?.close();
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
		this.settings.menuKeymap = Object.assign(
			{},
			DEFAULT_SETTINGS.menuKeymap,
			this.settings.menuKeymap || {}
		);
		if (!this.settings.virtualTextColor) {
			this.settings.virtualTextColor = "var(--text-muted)";
		}
		if (typeof this.settings.autoShowMenu !== "boolean") {
			this.settings.autoShowMenu = DEFAULT_SETTINGS.autoShowMenu;
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async loadSnippetsFromFile(): Promise<void> {
		const snippets = await this.snippetLoader.loadFromFile(
			this.settings.snippetsFilePath
		);
		this.settings.snippets = snippets;
		this.snippetEngine.setSnippets(snippets);

		if (snippets.length > 0) {
			new Notice(`✅ Loaded ${snippets.length} snippets`);
		} else {
			new Notice("⚠️ No snippets loaded");
		}
	}

	private registerCommands(): void {
		this.addCommand({
			id: "text-snippets-expand",
			name: "Expand snippet",
			callback: () => this.snippetManager.expandSnippet(),
			hotkeys: [{ modifiers: ["Mod"], key: "Enter" }],
		});

		this.addCommand({
			id: "text-snippets-jump-next",
			name: "Jump to next tab stop",
			callback: () => this.snippetManager.jumpToNextTabStop(),
			hotkeys: [{ modifiers: ["Mod"], key: "Tab" }],
		});

		this.addCommand({
			id: "text-snippets-jump-prev",
			name: "Jump to previous tab stop",
			callback: () => this.snippetManager.jumpToPrevTabStop(),
			hotkeys: [{ modifiers: ["Mod", "Shift"], key: "Tab" }],
		});

		this.addCommand({
			id: "text-snippets-reload",
			name: "Reload snippets from file",
			callback: () => this.reloadSnippetsCommand(),
		});

		this.addCommand({
			id: "text-snippets-debug",
			name: "Debug: Print all snippets to console",
			callback: () => this.debugPrintSnippets(),
		});

		this.addCommand({
			id: "text-snippets-open-menu",
			name: "Open snippet menu",
			editorCallback: (editor) => {
				this.openSnippetMenu(editor);
			},
			hotkeys: [{ modifiers: ["Mod", "Shift"], key: "S" }],
		});
	}

	private async reloadSnippetsCommand(): Promise<void> {
		if (!this.settings.snippetsFilePath) {
			new Notice("⚠️ No snippet file configured");
			return;
		}

		this.logger.debug("📂 Reloading snippets...");
		await this.loadSnippetsFromFile();
	}

	private debugPrintSnippets(): void {
		const snippets = this.snippetEngine.getSnippets();
		console.log("=== Loaded Snippets ===");
		console.log(`File: ${this.settings.snippetsFilePath}`);
		console.log(`Count: ${snippets.length}`);
		snippets.forEach((s, i) => {
			console.log(
				`[${i + 1}] ${s.prefix}: ${s.description || "(no description)"}`
			);
		});
		console.log("======================");
	}

	private createTriggerKeymapExtension(): Extension {
		return buildTriggerKeymapExtension({
			triggerKey: this.settings.triggerKey,
			menuKeymap: this.settings.menuKeymap,
			handleTrigger: (view: EditorView) =>
				this.handleSnippetTrigger(view),
			handleToggle: (view: EditorView) =>
				this.handleMenuToggleShortcut(view),
			forceExitSnippetMode: (view: EditorView) =>
				this.snippetManager.forceExitSnippetMode(view),
			menuHandlers: {
				next: () => this.snippetMenu.navigate(1),
				prev: () => this.snippetMenu.navigate(-1),
				accept: () => this.snippetMenu.acceptCurrent(),
			},
		});
	}

	private handleSnippetTrigger(_view: EditorView): boolean {
		if (this.snippetManager.expandSnippet()) {
			return true;
		}
		if (this.snippetManager.jumpToNextTabStop({ silent: true })) {
			return true;
		}
		if (this.settings.autoShowMenu) {
			const opened = this.openSnippetMenu(
				this.snippetManager.getActiveEditor() ?? undefined
			);
			return opened;
		}
		return false;
	}

	private handleMenuToggleShortcut(_view: EditorView): boolean {
		const editor = this.snippetManager.getActiveEditor();
		if (!editor) return false;
		const query = this.extractQueryFragment(editor);
		return this.snippetMenu.toggle(editor, query);
	}

	private openSnippetMenu(
		editor?: Editor | null,
		initialQuery?: string
	): boolean {
		const targetEditor = editor ?? this.snippetManager.getActiveEditor();
		if (!targetEditor) {
			return false;
		}
		const query = initialQuery ?? this.extractQueryFragment(targetEditor);
		return this.snippetMenu.open(targetEditor, query);
	}

	private extractQueryFragment(editor: Editor): string {
		const cursor = editor.getCursor();
		const line = editor.getLine(cursor.line) ?? "";
		const prefix = line.slice(0, cursor.ch);
		const match = prefix.match(/(\S+)$/);
		return match?.[0] ?? "";
	}

	public applyRuntimeSettings(): void {
		this.logger.setEnabled(this.settings.enableDebugLogs);
		if (this.snippetEngine) {
			this.snippetEngine.setLogger(this.logger);
		}
		setSnippetWidgetConfig({
			enabled: this.settings.showVirtualText,
			color: this.settings.virtualTextColor,
		});
		this.reconfigureTriggerKeymap();
	}

	private reconfigureTriggerKeymap(): void {
		const extension = this.createTriggerKeymapExtension();
		const leaves = this.app.workspace.getLeavesOfType("markdown");
		for (const leaf of leaves) {
			const view = leaf.view;
			if (view instanceof MarkdownView) {
				const editorView = getEditorView(view.editor);
				if (editorView) {
					editorView.dispatch({
						effects:
							this.triggerKeymapCompartment.reconfigure(
								extension
							),
					});
				}
			}
		}
	}

	private getActiveEditor(): Editor | null {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		return view?.editor || null;
	}

	private handleGlobalKeydown(event: KeyboardEvent): void {
		const isEscape =
			event.key === "Escape" &&
			!event.ctrlKey &&
			!event.metaKey &&
			!event.altKey &&
			!event.shiftKey;
		const isCtrlBracket =
			event.key === "[" &&
			event.ctrlKey &&
			!event.metaKey &&
			!event.altKey &&
			!event.shiftKey;
		if (!isEscape && !isCtrlBracket) {
			return;
		}

		const editor = this.getActiveEditor();
		if (!editor) return;
		const editorView = getEditorView(editor);

		this.snippetManager.forceExitSnippetMode(editorView ?? undefined);
	}

	getSnippetLoader(): SnippetLoader {
		return this.snippetLoader;
	}
}
