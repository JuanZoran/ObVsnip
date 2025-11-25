import { Editor, MarkdownView, Plugin, Notice } from "obsidian";
import { Compartment } from "@codemirror/state";
import type { Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type {
	ParsedSnippet,
	SnippetMenuKeymap,
	PluginSettings,
	RankingAlgorithmId,
	RankingAlgorithmSetting,
	VirtualTextColorPreset,
} from "./src/types";
import { SnippetLoader } from "./src/snippetLoader";
import { SnippetEngine } from "./src/snippetEngine";
import {
	snippetSessionExtensions,
	setSnippetWidgetConfig,
	setDebugRealtimeSync,
} from "./src/snippetSession";
import { SnippetManager } from "./src/snippetManager";
import { PluginLogger } from "./src/logger";
import type { DebugCategory } from "./src/logger";
import { getActiveEditor, getEditorView } from "./src/utils/editorUtils";
import { TextSnippetsSettingsTab } from "./src/settingsTab";
import { buildTriggerKeymapExtension } from "./src/utils/keymap";
import { SnippetCompletionMenu } from "./src/snippetSuggest";
import {
	getLocaleStrings,
	type LocaleStrings,
} from "./src/i18n";
import { getContextBeforeCursor } from "./src/utils/prefixContext";
import { normalizeRankingAlgorithms } from "./src/rankingConfig";
import { incrementUsageCount, usageRecordToMap } from "./src/usageTracker";
import {
	BUILTIN_COLOR_SCHEMES,
	ensurePluginSettings,
} from "./src/config/defaults";

export default class TextSnippetsPlugin extends Plugin {
	settings: PluginSettings;
	private snippetLoader: SnippetLoader;
	private snippetEngine: SnippetEngine;
	private triggerKeymapCompartment = new Compartment();
	private snippetManager: SnippetManager;
	private logger = new PluginLogger();
	private snippetMenu: SnippetCompletionMenu;
	private localeStrings: LocaleStrings = getLocaleStrings("en");
	private usageSaveTimer: number | null = null;
	async onload() {
		await this.loadSettings();
		this.logger.debug("general", "🚀 Loading ObVsnip plugin");
		this.refreshLocaleStrings();

		this.snippetLoader = new SnippetLoader(this.app, this.logger);
		this.snippetEngine = new SnippetEngine([]);
		this.snippetManager = new SnippetManager(
			this.app,
			this.snippetEngine,
			this.logger,
			{
				onSnippetApplied: (snippet) => this.recordSnippetUsage(snippet),
				getSettings: () => this.settings,
			}
		);

		if (this.settings.snippetFiles.length > 0) {
			const runLoad = async () => {
				await this.loadSnippetsFromFiles();
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
			getRankingAlgorithms: () => this.settings.rankingAlgorithms,
			getUsageCounts: () => this.getSnippetUsageCounts(),
			getPrefixInfo: () => this.snippetEngine.getPrefixInfo(),
			getRankingAlgorithmNames: () => this.getRankingAlgorithmNames(),
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

		this.logger.debug("general", "✅ ObVsnip plugin loaded");
	}

	onunload() {
		this.flushUsageSave();
		this.logger.debug("general", "🛑 Unloading ObVsnip plugin");
		this.snippetMenu?.close();
	}

	async loadSettings() {
		const raw = await this.loadData();
		this.settings = ensurePluginSettings(raw ?? {});
		const legacyPath = (this.settings as any).snippetsFilePath;
		if (!Array.isArray(this.settings.snippetFiles)) {
			this.settings.snippetFiles = [];
		}
		if (
			legacyPath &&
			typeof legacyPath === "string" &&
			legacyPath.length > 0 &&
			this.settings.snippetFiles.length === 0
		) {
			this.settings.snippetFiles = [legacyPath];
		}
		delete (this.settings as any).snippetsFilePath;
		if (!Array.isArray(this.settings.debugCategories)) {
			this.settings.debugCategories = [];
		}
		this.settings.rankingAlgorithms = normalizeRankingAlgorithms(
			this.settings.rankingAlgorithms
		);
		if (
			!this.settings.snippetUsage ||
			typeof this.settings.snippetUsage !== "object"
		) {
			this.settings.snippetUsage = {};
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private recordSnippetUsage(snippet: ParsedSnippet): void {
		if (!snippet?.prefix) {
			return;
		}
		this.settings.snippetUsage = incrementUsageCount(
			this.settings.snippetUsage,
			snippet.prefix
		);
		this.scheduleUsageSave();
	}

	public getSnippetUsageCounts(): Map<string, number> {
		return usageRecordToMap(this.settings.snippetUsage);
	}

	public getAvailableSnippets(): ParsedSnippet[] {
		return this.snippetEngine.getSnippets();
	}

	public getRankingAlgorithmNames(): Record<RankingAlgorithmId, string> {
		return this.localeStrings.settings.rankingAlgorithmNames;
	}

	private scheduleUsageSave(): void {
		if (this.usageSaveTimer !== null) return;
		this.usageSaveTimer = window.setTimeout(() => {
			this.usageSaveTimer = null;
			void this.saveSettings();
		}, 1000);
	}

	private flushUsageSave(): void {
		if (this.usageSaveTimer === null) return;
		window.clearTimeout(this.usageSaveTimer);
		this.usageSaveTimer = null;
		void this.saveSettings();
	}

	async loadSnippetsFromFiles(filePaths?: string[]): Promise<void> {
		const targets = filePaths ?? this.settings.snippetFiles;
		if (!targets || targets.length === 0) {
			new Notice("⚠️ No snippet files configured");
			this.snippetEngine.setSnippets([]);
			return;
		}

		const successes: string[] = [];
		const failures: string[] = [];
		const aggregated: ParsedSnippet[] = [];

		for (const path of targets) {
			const snippets = await this.snippetLoader.loadFromFile(path);
			if (snippets.length > 0) {
				successes.push(`${path} (${snippets.length})`);
				aggregated.push(...snippets);
			} else {
				failures.push(path);
			}
		}

		this.snippetEngine.setSnippets(aggregated);

		if (aggregated.length > 0) {
			const detail = successes.length
				? ` from ${successes.length} file(s)`
				: "";
			new Notice(`✅ Loaded ${aggregated.length} snippets${detail}`);
			this.logger.debug(
				"loader",
				`Loaded snippets: ${successes.join(", ")}`
			);
		}

		if (failures.length > 0) {
			new Notice(
				`⚠️ Failed to load snippets from: ${failures.join(", ")}`,
				6000
			);
			this.logger.debug(
				"loader",
				`Failed snippet files: ${failures.join(", ")}`
			);
		}
	}

	private getCommandEditor(editor?: Editor | null): Editor | null {
		return (
			editor ??
			this.app.workspace.getActiveViewOfType(MarkdownView)?.editor ??
			null
		);
	}

	private registerCommands(): void {
		this.addCommand({
			id: "text-snippets-expand",
			name: this.localeStrings.commands.expand,
			editorCheckCallback: (checking, editor) => {
				const targetEditor = this.getCommandEditor(editor);
				if (checking) return !!targetEditor;
				if (!targetEditor) return false;
				return this.snippetManager.expandSnippet();
			},
			hotkeys: [{ modifiers: ["Mod"], key: "Enter" }],
		});

		this.addCommand({
			id: "text-snippets-jump-next",
			name: this.localeStrings.commands.jumpNext,
			editorCheckCallback: (checking, editor) => {
				const targetEditor = this.getCommandEditor(editor);
				if (checking) return !!targetEditor;
				if (!targetEditor) return false;
				return this.snippetManager.jumpToNextTabStop();
			},
			hotkeys: [{ modifiers: ["Mod"], key: "Tab" }],
		});

		this.addCommand({
			id: "text-snippets-jump-prev",
			name: this.localeStrings.commands.jumpPrev,
			editorCheckCallback: (checking, editor) => {
				const targetEditor = this.getCommandEditor(editor);
				if (checking) return !!targetEditor;
				if (!targetEditor) return false;
				this.snippetManager.jumpToPrevTabStop();
				return true;
			},
			hotkeys: [{ modifiers: ["Mod", "Shift"], key: "Tab" }],
		});

		this.addCommand({
			id: "text-snippets-reload",
			name: this.localeStrings.commands.reload,
			callback: () => this.reloadSnippetsCommand(),
		});

		this.addCommand({
			id: "text-snippets-debug",
			name: this.localeStrings.commands.debug,
			callback: () => this.debugPrintSnippets(),
		});

		this.addCommand({
			id: "text-snippets-open-menu",
			name: this.localeStrings.commands.openMenu,
			editorCheckCallback: (checking, editor) => {
				const targetEditor = this.getCommandEditor(editor);
				if (checking) return !!targetEditor;
				if (!targetEditor) return false;
				return this.openSnippetMenu(targetEditor);
			},
			hotkeys: [{ modifiers: ["Mod", "Shift"], key: "S" }],
		});
	}

	private async reloadSnippetsCommand(): Promise<void> {
		if (this.settings.snippetFiles.length === 0) {
			new Notice("⚠️ No snippet files configured");
			return;
		}

		this.logger.debug("general", "📂 Reloading snippets...");
		await this.loadSnippetsFromFiles();
	}

	private debugPrintSnippets(): void {
		const snippets = this.snippetEngine.getSnippets();
		console.log("=== Loaded Snippets ===");
		console.log(
			`Files: ${
				this.settings.snippetFiles.length > 0
					? this.settings.snippetFiles.join(", ")
					: "(none)"
			}`
		);
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
		return false;
	}

	private handleMenuToggleShortcut(_view: EditorView): boolean {
		const editor = getActiveEditor(this.app);
		if (!editor) return false;
		if (this.snippetManager.cycleChoiceAtCurrentStop()) {
			return true;
		}
		const query = this.resolveQueryFragment(editor);
		return this.snippetMenu.toggle(editor, query);
	}

	private openSnippetMenu(
		editor?: Editor | null,
		initialQuery?: string
	): boolean {
		const targetEditor = editor ?? getActiveEditor(this.app);
		if (!targetEditor) {
			return false;
		}
		const query = initialQuery && initialQuery.length > 0
			? initialQuery
			: this.resolveQueryFragment(targetEditor);
		return this.snippetMenu.open(targetEditor, query);
	}

	private resolveQueryFragment(editor: Editor): string {
		const prefixInfo = this.snippetEngine.getPrefixInfo();
		const context = getContextBeforeCursor({
			editor,
			prefixInfo,
		});
		return context?.text ?? "";
	}

	public applyRuntimeSettings(): void {
		this.logger.setEnabled(this.settings.enableDebugLogs);
		this.logger.setCategories(this.settings.debugCategories);
		setSnippetWidgetConfig({
			enabled: this.settings.showVirtualText,
			placeholderColor: this.settings.virtualTextColor,
			placeholderActiveColor: this.settings.placeholderActiveColor,
			ghostTextColor: this.settings.ghostTextColor,
			choiceActiveColor: this.settings.choiceHighlightColor,
			choiceInactiveColor: this.settings.choiceInactiveColor,
		});
		// Set debug mode for reference realtime sync based on enableDebugLogs
		setDebugRealtimeSync(this.settings.enableDebugLogs);
		this.reconfigureTriggerKeymap();
	}

	public getVirtualTextColorPresets(): VirtualTextColorPreset[] {
		return [
			...BUILTIN_COLOR_SCHEMES,
			...this.settings.virtualTextPresets.map((preset) => ({
				...preset,
			})),
		];
	}

	public getSelectedVirtualTextPresetName(): string {
		return this.settings.selectedVirtualTextPresetName ?? "";
	}

	public saveVirtualTextColorPreset(preset: VirtualTextColorPreset): void {
		const normalized = (preset.name ?? "").trim();
		if (!normalized) return;
		const existingIndex = this.settings.virtualTextPresets.findIndex(
			(entry) => entry.name === normalized
		);
		const entry: VirtualTextColorPreset = {
			...preset,
			name: normalized,
		};
		if (existingIndex >= 0) {
			this.settings.virtualTextPresets[existingIndex] = entry;
		} else {
			this.settings.virtualTextPresets.push(entry);
		}
	}

	public applyVirtualTextColorPreset(preset: VirtualTextColorPreset): void {
		this.settings.virtualTextColor = preset.placeholderColor;
		this.settings.placeholderActiveColor = preset.placeholderActiveColor;
		this.settings.ghostTextColor = preset.ghostTextColor;
		this.settings.choiceHighlightColor = preset.choiceActiveColor;
		this.settings.choiceInactiveColor = preset.choiceInactiveColor;
		this.settings.selectedVirtualTextPresetName = preset.name ?? "";
		this.applyRuntimeSettings();
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

		const editor = getActiveEditor(this.app);
		if (!editor) return;
		const editorView = getEditorView(editor);

		this.snippetManager.forceExitSnippetMode(editorView ?? undefined);
	}

	getSnippetLoader(): SnippetLoader {
		return this.snippetLoader;
	}

	getStrings(): LocaleStrings {
		return this.localeStrings;
	}

	private refreshLocaleStrings(): void {
		const locale = this.getCurrentLocale();
		this.localeStrings = getLocaleStrings(locale);
	}

	private getCurrentLocale(): string | undefined {
		const vaultWithLocale = this.app.vault as typeof this.app.vault & {
			getConfig?: (key: string) => unknown;
		};
		const configKeys = ["locale", "language"];
		for (const key of configKeys) {
			const raw = vaultWithLocale.getConfig?.(key);
			if (typeof raw === "string" && raw.length > 0) {
				return raw;
			}
		}
		if (typeof window !== "undefined" && window.localStorage) {
			for (const key of ["language", "locale"]) {
				const stored = window.localStorage.getItem(key);
				if (stored) return stored;
			}
		}
		return undefined;
	}
}
