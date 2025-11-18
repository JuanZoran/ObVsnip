import {
	App,
	Menu,
	Notice,
	PluginSettingTab,
	Setting,
	TFile,
	Modal,
} from "obsidian";
import type TextSnippetsPlugin from "../main";
import type {
	RankingAlgorithmId,
	RankingAlgorithmSetting,
	SnippetMenuKeymap,
} from "./types";
import type { DebugCategory } from "./logger";
import { BUILTIN_VARIABLES } from "./snippetBody";
import {
	moveEnabledAlgorithm,
	normalizeRankingAlgorithms,
	toggleAlgorithmEnabled,
} from "./rankingConfig";

const DEBUG_CATEGORY_KEYS: DebugCategory[] = [
	"general",
	"loader",
	"parser",
	"manager",
	"menu",
	"session",
];

class VariableHelpModal extends Modal {
	constructor(
		app: App,
		private titleText: string,
		private description: string,
		private entries: Array<{ name: string; detail: string }>
	) {
		super(app);
	}

	onOpen(): void {
		this.contentEl.empty();
		this.contentEl.addClass("variable-help-modal");
		this.contentEl.setAttr(
			"style",
			"max-height:60vh;overflow:auto;padding:12px 18px;"
		);

		this.contentEl.createEl("h2", { text: this.titleText });
		this.contentEl.createEl("p", { text: this.description });

		const list = this.contentEl.createDiv({ cls: "variable-help-list" });
		for (const entry of this.entries) {
			const row = list.createDiv({ cls: "variable-help-row" });
			row.setAttr(
				"style",
				"display:flex;gap:12px;margin-bottom:6px;align-items:flex-start;"
			);

			const nameEl = row.createEl("code", {
				text: entry.name,
			});
			nameEl.setAttr(
				"style",
				"min-width:140px;display:inline-block;font-size:var(--code-size);"
			);

			row.createSpan({
				text: entry.detail,
			});
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

export class TextSnippetsSettingsTab extends PluginSettingTab {
	private plugin: TextSnippetsPlugin;
	private rankingListWrapper: HTMLElement | null = null;
	private draggedAlgorithmId: RankingAlgorithmId | null = null;
	private virtualPreviewSnippet: HTMLElement | null = null;

	constructor(app: App, plugin: TextSnippetsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		const strings = this.plugin.getStrings().settings;
		containerEl.empty();
		containerEl.createEl("h2", { text: strings.title });
		this.createFileSelectionSetting();
		this.createSettingsSection();
	}

	private createFileSelectionSetting(): void {
		const { containerEl } = this;
		const strings = this.plugin.getStrings().settings;

		containerEl.createEl("h3", { text: strings.snippetFilesListName });
		containerEl.createEl("p", { text: strings.snippetFilesListDesc });
		const listWrapper = containerEl.createDiv({ cls: "snippet-files-list" });
		this.renderSnippetFileEntries(listWrapper, strings);
		containerEl.createEl("p", {
			text: strings.snippetFilesOrderHint,
			cls: "setting-item-description",
		});

		new Setting(containerEl)
			.setName(strings.fileName)
			.setDesc(strings.fileDesc)
			.addButton((btn) =>
				btn
					.setButtonText(strings.snippetFilesAddButton)
					.setCta()
					.onClick((event) => this.showFileMenu(event))
			)
			.addButton((btn) =>
				btn
					.setButtonText(strings.snippetFilesReloadButton)
					.onClick(() => this.handleReloadSnippets())
			);
	}

	private createSettingsSection(): void {
		const { containerEl } = this;
		const strings = this.plugin.getStrings().settings;
		containerEl.createEl("h3", { text: strings.triggerSection });

		new Setting(containerEl)
			.setName(strings.triggerName)
			.setDesc(strings.triggerDesc)
			.addText((text) =>
				text
					.setPlaceholder("Tab")
					.setValue(this.plugin.settings.triggerKey)
					.onChange(async (value) => {
						this.plugin.settings.triggerKey = value.trim() || "Tab";
						await this.plugin.saveSettings();
						this.plugin.applyRuntimeSettings();
					})
			);

		containerEl.createEl("h3", { text: strings.pickerSection });
		containerEl.createEl("p", {
			text: strings.pickerHint,
		});
		this.addMenuKeySetting(
			containerEl,
			"next",
			strings.menuKeys.nextName,
			strings.menuKeys.nextDesc,
			"ArrowDown"
		);
		this.addMenuKeySetting(
			containerEl,
			"prev",
			strings.menuKeys.prevName,
			strings.menuKeys.prevDesc,
			"ArrowUp"
		);
		this.addMenuKeySetting(
			containerEl,
			"accept",
			strings.menuKeys.acceptName,
			strings.menuKeys.acceptDesc,
			"Enter"
		);
		this.addMenuKeySetting(
			containerEl,
			"toggle",
			strings.menuKeys.toggleName,
			strings.menuKeys.toggleDesc,
			"Mod-Shift-S"
		);

		this.renderRankingAlgorithmSettings(containerEl, strings);

		containerEl.createEl("h3", { text: strings.virtualSection });

		new Setting(containerEl)
			.setName(strings.showHintsName)
			.setDesc(strings.showHintsDesc)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showVirtualText)
					.onChange(async (value) => {
						this.plugin.settings.showVirtualText = value;
						await this.plugin.saveSettings();
						this.plugin.applyRuntimeSettings();
					})
			);

		this.addColorSetting(
			containerEl,
			strings.placeholderColorName,
			strings.placeholderColorDesc,
			this.plugin.settings.virtualTextColor,
			async (value) => {
				this.plugin.settings.virtualTextColor = value || "";
				await this.plugin.saveSettings();
				this.plugin.applyRuntimeSettings();
				this.updateVirtualPreviewStyles();
			}
		);

		this.addColorSetting(
			containerEl,
			strings.choiceHighlightName,
			strings.choiceHighlightDesc,
			this.plugin.settings.choiceHighlightColor,
			async (value) => {
				this.plugin.settings.choiceHighlightColor = value || "";
				await this.plugin.saveSettings();
				this.plugin.applyRuntimeSettings();
				this.updateVirtualPreviewStyles();
			}
		);
		this.addColorSetting(
			containerEl,
			strings.choiceInactiveName,
			strings.choiceInactiveDesc,
			this.plugin.settings.choiceInactiveColor,
			async (value) => {
				this.plugin.settings.choiceInactiveColor = value || "";
				await this.plugin.saveSettings();
				this.plugin.applyRuntimeSettings();
				this.updateVirtualPreviewStyles();
			}
		);
		this.addColorSetting(
			containerEl,
			strings.placeholderActiveName,
			strings.placeholderActiveDesc,
			this.plugin.settings.placeholderActiveColor,
			async (value) => {
				this.plugin.settings.placeholderActiveColor = value || "";
				await this.plugin.saveSettings();
				this.plugin.applyRuntimeSettings();
				this.updateVirtualPreviewStyles();
			}
		);
		this.addColorSetting(
			containerEl,
			strings.ghostTextName,
			strings.ghostTextDesc,
			this.plugin.settings.ghostTextColor,
			async (value) => {
				this.plugin.settings.ghostTextColor = value || "";
				await this.plugin.saveSettings();
				this.plugin.applyRuntimeSettings();
				this.updateVirtualPreviewStyles();
			}
		);
		this.renderVirtualTextPreview(containerEl, strings);

		containerEl.createEl("h3", { text: strings.debugSection });

		new Setting(containerEl)
			.setName(strings.debugName)
			.setDesc(strings.debugDesc)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableDebugLogs)
					.onChange(async (value) => {
						this.plugin.settings.enableDebugLogs = value;
						await this.plugin.saveSettings();
						this.plugin.applyRuntimeSettings();
						this.toggleDebugModuleControls(modulesWrapper, value);
					})
			);

		const modulesWrapper = containerEl.createDiv();
		this.renderDebugModuleSettings(modulesWrapper, strings);
		this.toggleDebugModuleControls(
			modulesWrapper,
			this.plugin.settings.enableDebugLogs
		);

		new Setting(containerEl)
			.setName(strings.variableHelpName)
			.setDesc(strings.variableHelpDesc)
			.addButton((btn) =>
				btn.setButtonText("ℹ️").onClick(() => this.showVariableHelp())
			);
	}

	private renderDebugModuleSettings(
		containerEl: HTMLElement,
		strings: ReturnType<TextSnippetsPlugin["getStrings"]>["settings"]
	): void {
		containerEl.addClass("debug-modules-wrapper");
		new Setting(containerEl)
			.setName(strings.debugCategoriesName)
			.setDesc(strings.debugCategoriesDesc);

		const categoryLabels = strings.debugCategoryOptions;
		DEBUG_CATEGORY_KEYS.forEach((key) => {
			const debugRow = new Setting(containerEl)
				.setName(categoryLabels[key])
				.addToggle((toggle) =>
					toggle
						.setValue(
							this.plugin.settings.debugCategories.includes(key)
						)
						.onChange(async (value) => {
							const categories = new Set(
								this.plugin.settings.debugCategories
							);
							if (value) {
								categories.add(key);
							} else {
								categories.delete(key);
							}
							this.plugin.settings.debugCategories = Array.from(
								categories
							);
							await this.plugin.saveSettings();
							this.plugin.applyRuntimeSettings();
						})
				);
			const rowEl = debugRow.settingEl;
			if (rowEl) {
				rowEl.addClass("debug-module-item");
			}
		});
	}

	private toggleDebugModuleControls(
		container: HTMLElement,
		enabled: boolean
	): void {
		container.style.display = enabled ? "" : "none";
	}

	private renderRankingAlgorithmSettings(
		containerEl: HTMLElement,
		strings: ReturnType<TextSnippetsPlugin["getStrings"]>["settings"]
	): void {
		containerEl.createEl("h3", { text: strings.rankingSection });
		containerEl.createEl("p", {
			text: strings.rankingSectionDesc,
			cls: "setting-item-description",
		});
		containerEl.createEl("p", {
			text: strings.rankingStableNote,
			cls: "setting-item-description",
		});
		this.rankingListWrapper = containerEl.createDiv({
			cls: "ranking-algorithms-list",
		});
		this.renderRankingAlgorithmRows(strings);
	}

	private renderRankingAlgorithmRows(
		strings: ReturnType<TextSnippetsPlugin["getStrings"]>["settings"]
	): void {
		if (!this.rankingListWrapper) return;
		this.rankingListWrapper.empty();
		const normalized = normalizeRankingAlgorithms(
			this.plugin.settings.rankingAlgorithms
		);
		this.plugin.settings.rankingAlgorithms = normalized;
		const enabledCount = normalized.filter((entry) => entry.enabled).length;
		for (const entry of normalized) {
			this.renderRankingAlgorithmRow(entry, strings, enabledCount);
		}
	}

	private renderRankingAlgorithmRow(
		entry: RankingAlgorithmSetting,
		strings: ReturnType<TextSnippetsPlugin["getStrings"]>["settings"],
		enabledCount: number
	): void {
		const row = new Setting(this.rankingListWrapper!)
			.setName(strings.rankingAlgorithmNames[entry.id])
			.setDesc(
				entry.enabled
					? strings.rankingAlgorithmEnabledDesc
					: strings.rankingAlgorithmDisabledDesc
			)
			.addToggle((toggle) => {
				toggle
					.setValue(entry.enabled)
					.setDisabled(entry.enabled && enabledCount <= 1)
					.onChange(async (value) => {
						this.plugin.settings.rankingAlgorithms =
							toggleAlgorithmEnabled(
								this.plugin.settings.rankingAlgorithms,
								entry.id,
								value
							);
						await this.plugin.saveSettings();
						this.renderRankingAlgorithmRows(strings);
					});
			});

		const rowEl = row.settingEl;
		rowEl.setAttr("draggable", entry.enabled ? "true" : "false");
		rowEl.setAttr("data-algo-id", entry.id);
		rowEl.setAttr("data-enabled", entry.enabled ? "true" : "false");
		rowEl.addClass("ranking-algo-item");
		if (!entry.enabled) {
			rowEl.addClass("ranking-algo-disabled");
		}

		rowEl.addEventListener("dragstart", (event) =>
			this.handleRankingDragStart(event, entry)
		);
		rowEl.addEventListener("dragover", (event) =>
			this.handleRankingDragOver(event, entry)
		);
		rowEl.addEventListener("drop", (event) =>
			this.handleRankingDrop(event, entry, strings)
		);
		rowEl.addEventListener("dragend", () =>
			this.handleRankingDragEnd()
		);

		const handle = rowEl.createSpan({
			cls: "ranking-algo-handle",
			text: "⋮⋮",
		});
		rowEl.insertBefore(handle, rowEl.firstChild);
	}

	private handleRankingDragStart(
		event: DragEvent,
		algorithm: RankingAlgorithmSetting
	): void {
		if (!algorithm.enabled) {
			event.preventDefault();
			return;
		}
		this.draggedAlgorithmId = algorithm.id;
		event.dataTransfer?.setData("text/plain", algorithm.id);
		event.dataTransfer?.setDragImage(new Image(), 0, 0);
	}

	private handleRankingDragOver(
		event: DragEvent,
		algorithm: RankingAlgorithmSetting
	): void {
		if (
			!this.draggedAlgorithmId ||
			!algorithm.enabled ||
			this.draggedAlgorithmId === algorithm.id
		) {
			return;
		}
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = "move";
		}
	}

	private handleRankingDrop(
		event: DragEvent,
		target: RankingAlgorithmSetting,
		strings: ReturnType<TextSnippetsPlugin["getStrings"]>["settings"]
	): void {
		event.preventDefault();
		if (
			!this.draggedAlgorithmId ||
			!target.enabled ||
			this.draggedAlgorithmId === target.id
		) {
			return;
		}
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const insertAfter =
			event.clientY > rect.top + rect.height / 2;
		void this.applyRankingReorder(
			this.draggedAlgorithmId,
			target.id,
			insertAfter,
			strings
		);
		this.draggedAlgorithmId = null;
	}

	private handleRankingDragEnd(): void {
		this.draggedAlgorithmId = null;
	}

	private async applyRankingReorder(
		sourceId: RankingAlgorithmId,
		targetId: RankingAlgorithmId,
		insertAfter: boolean,
		strings: ReturnType<TextSnippetsPlugin["getStrings"]>["settings"]
	): Promise<void> {
		this.plugin.settings.rankingAlgorithms = moveEnabledAlgorithm(
			this.plugin.settings.rankingAlgorithms,
			sourceId,
			targetId,
			insertAfter
		);
		await this.plugin.saveSettings();
		this.renderRankingAlgorithmRows(strings);
	}

	private showVariableHelp(): void {
		const strings = this.plugin.getStrings().settings;
		const detailMap = strings.variableDetails;
		const entries = Array.from(BUILTIN_VARIABLES)
			.sort()
			.map((name) => ({
				name,
				detail: detailMap[name] ?? "",
			}));
		const modal = new VariableHelpModal(
			this.app,
			strings.variableHelpName,
			strings.variableHelpDesc,
			entries
		);
		modal.open();
	}

	private showFileMenu(event: MouseEvent | undefined): void {
		const files = this.plugin.getSnippetLoader().getTextFiles();

		if (files.length === 0) {
			new Notice("No text files found in vault");
			return;
		}

		const menu = new Menu();
		files.forEach((file: TFile) => {
			menu.addItem((item) =>
				item.setTitle(file.path).onClick(async () => {
					await this.handleSnippetFileSelected(file.path);
				})
			);
		});

		if (event) {
			menu.showAtMouseEvent(event);
			return;
		}

		// Fallback in case the mouse event is unavailable.
		menu.showAtPosition({
			x: window.innerWidth / 2,
			y: window.innerHeight / 2,
		});
	}

	private addMenuKeySetting(
		containerEl: HTMLElement,
		key: keyof SnippetMenuKeymap,
		label: string,
		desc: string,
		placeholder: string
	): void {
		new Setting(containerEl)
			.setName(label)
			.setDesc(desc)
			.addText((text) =>
				text
					.setPlaceholder(placeholder)
					.setValue(this.plugin.settings.menuKeymap[key] || "")
					.onChange(async (value) => {
						this.plugin.settings.menuKeymap[key] = value.trim();
						await this.plugin.saveSettings();
						this.plugin.applyRuntimeSettings();
					})
			);
	}

	private renderSnippetFileEntries(
		container: HTMLElement,
		strings: ReturnType<TextSnippetsPlugin["getStrings"]>["settings"]
	): void {
		container.empty();
		const files = this.plugin.settings.snippetFiles;
		if (files.length === 0) {
			container.createEl("p", {
				text: strings.snippetFilesEmpty,
				cls: "setting-item-description",
			});
			return;
		}

		files.forEach((path, index) => {
			const row = new Setting(container).setName(`${index + 1}. ${path}`);
			row.addButton((btn) =>
				btn.setButtonText(strings.editButton).onClick(async () => {
					const file = this.app.vault.getAbstractFileByPath(path);
					if (!(file instanceof TFile)) {
						new Notice("File not found in vault");
						return;
					}
					await this.app.workspace.getLeaf().openFile(file);
				})
			);
			row.addButton((btn) =>
				btn
					.setButtonText(strings.snippetFilesRemoveButton)
					.setWarning()
					.onClick(() => this.handleRemoveSnippetFile(path))
			);
		});
	}

	private async handleSnippetFileSelected(path: string): Promise<void> {
		if (!path) return;
		if (!this.plugin.settings.snippetFiles.includes(path)) {
			this.plugin.settings.snippetFiles.push(path);
			await this.plugin.saveSettings();
			await this.plugin.loadSnippetsFromFiles();
		}
		this.display();
	}

	private async handleRemoveSnippetFile(path: string): Promise<void> {
		this.plugin.settings.snippetFiles = this.plugin.settings.snippetFiles.filter(
			(p) => p !== path
		);
		await this.plugin.saveSettings();
		await this.plugin.loadSnippetsFromFiles();
		this.display();
	}

	private addColorSetting(
		containerEl: HTMLElement,
		name: string,
		desc: string,
		value: string,
		onChange: (value: string) => Promise<void>
	): void {
		new Setting(containerEl)
			.setName(name)
			.setDesc(desc)
			.addText((text) => {
				text
					.setPlaceholder("#000000")
					.setValue(value)
					.onChange(onChange);
				text.inputEl.setAttribute("type", "color");
		});
	}

	private updateVirtualPreviewStyles(): void {
		if (!this.virtualPreviewSnippet) return;
		const vars = [
			`--snippet-placeholder-color: ${this.plugin.settings.virtualTextColor}`,
			`--snippet-placeholder-active-color: ${this.plugin.settings.placeholderActiveColor}`,
			`--snippet-ghost-text-color: ${this.plugin.settings.ghostTextColor}`,
			`--snippet-choice-active-color: ${this.plugin.settings.choiceHighlightColor}`,
			`--snippet-choice-inactive-color: ${this.plugin.settings.choiceInactiveColor}`,
		];
		this.virtualPreviewSnippet.style.cssText = vars.join(";");
	}

	private renderVirtualTextPreview(
		containerEl: HTMLElement,
		strings: ReturnType<TextSnippetsPlugin["getStrings"]>["settings"]
	): void {
		const wrapper = containerEl.createDiv({ cls: "virtual-text-preview" });
		wrapper.createEl("div", {
			text: strings.virtualPreviewTitle,
			cls: "virtual-preview-title",
		});
		wrapper.createEl("div", {
			text: strings.virtualPreviewDesc,
			cls: "virtual-preview-desc",
		});
		const snippet = wrapper.createDiv({ cls: "virtual-preview-snippet" });
		const placeholder = snippet.createSpan({
			cls: "preview-placeholder",
			text: strings.virtualPreviewSamplePlaceholder,
		});
		const placeholderActive = snippet.createSpan({
			cls: "preview-placeholder-active",
			text: strings.virtualPreviewSampleActivePlaceholder,
		});
		snippet.appendChild(document.createTextNode("⚙️ "));
		const choices = snippet.createSpan({
			cls: "preview-choice-list",
		});
		const sampleChoices =
			strings.virtualPreviewSampleChoices.length > 0
				? strings.virtualPreviewSampleChoices
				: ["Option A", "Option B", "Option C"];
		sampleChoices.forEach((choice, index) => {
			const entry = choices.createSpan({
				cls: "snippet-choice-entry",
				text: choice,
			});
			if (index === sampleChoices.length - 1) {
				entry.classList.add("snippet-choice-entry-active");
			}
			if (index < sampleChoices.length - 1) {
				choices.appendChild(document.createTextNode("/"));
			}
		});
		const ghostTextSpan = snippet.createSpan({
			cls: "preview-ghost-text",
			text: strings.virtualPreviewSampleGreeting,
		});
		snippet.appendChild(ghostTextSpan);
		this.virtualPreviewSnippet = snippet;
		this.updateVirtualPreviewStyles();
	}

	private async handleReloadSnippets(): Promise<void> {
		await this.plugin.loadSnippetsFromFiles();
	}

}
