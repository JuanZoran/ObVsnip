import { App, Menu, Notice, PluginSettingTab, Setting, TFile, Modal } from "obsidian";
import type TextSnippetsPlugin from "../main";
import type { SnippetMenuKeymap } from "./types";
import type { DebugCategory } from "./logger";
import type { SnippetSortMode } from "./snippetSuggest";
import { BUILTIN_VARIABLES } from "./snippetBody";

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

		new Setting(containerEl)
			.setName(strings.fileName)
			.setDesc(strings.fileDesc)
			.addText((text) =>
				text
					.setPlaceholder("snippets.json")
					.setValue(this.plugin.settings.snippetsFilePath)
					.setDisabled(true)
			)
			.addButton((btn) =>
				btn
					.setButtonText(strings.chooseButton)
					.setCta()
					.onClick(() => this.showFileMenu())
			)
			.addButton((btn) =>
				btn.setButtonText(strings.editButton).onClick(async () => {
					if (!this.plugin.settings.snippetsFilePath) {
						new Notice("Please select a snippet file first");
						return;
					}
					await this.openFileInEditor();
				})
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

		new Setting(containerEl)
			.setName(strings.sortName)
			.setDesc(strings.sortDesc)
			.addDropdown((dropdown) =>
				dropdown
					.addOption("smart", strings.sortOptions.smart)
					.addOption("prefix-length", strings.sortOptions.length)
					.addOption("none", strings.sortOptions.none)
					.setValue(this.plugin.settings.menuSortMode)
					.onChange(async (value) => {
						this.plugin.settings.menuSortMode = value as SnippetSortMode;
						await this.plugin.saveSettings();
					})
			);

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
	}

	private renderDebugModuleSettings(
		containerEl: HTMLElement,
		strings: ReturnType<TextSnippetsPlugin["getStrings"]>["settings"]
	): void {
		new Setting(containerEl)
			.setName(strings.debugCategoriesName)
			.setDesc(strings.debugCategoriesDesc);

		const categoryLabels = strings.debugCategoryOptions;
		DEBUG_CATEGORY_KEYS.forEach((key) => {
			new Setting(containerEl)
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
		});

		new Setting(containerEl)
			.setName(strings.variableHelpName)
			.setDesc(strings.variableHelpDesc)
			.addButton((btn) =>
				btn.setButtonText("ℹ️").onClick(() => this.showVariableHelp())
			);
	}

	private toggleDebugModuleControls(
		container: HTMLElement,
		enabled: boolean
	): void {
		container.style.display = enabled ? "" : "none";
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

	private showFileMenu(): void {
		const files = this.plugin.getSnippetLoader().getTextFiles();

		if (files.length === 0) {
			new Notice("No text files found in vault");
			return;
		}

		const menu = new Menu();
		files.forEach((file: TFile) => {
			menu.addItem((item) =>
				item.setTitle(file.path).onClick(async () => {
					this.plugin.settings.snippetsFilePath = file.path;
					await this.plugin.saveSettings();
					await this.plugin.loadSnippetsFromFile();
					this.display();
				})
			);
		});

		menu.showAtMouseEvent(event as MouseEvent);
	}

	private async openFileInEditor(): Promise<void> {
		const filePath = this.plugin.settings.snippetsFilePath;
		if (!filePath) return;

		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (file && file.hasOwnProperty("stat")) {
			await this.app.workspace.getLeaf().openFile(file as TFile);
		}
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
}
